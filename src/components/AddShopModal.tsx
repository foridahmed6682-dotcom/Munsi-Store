import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  Store,
  MapPin,
  LocateFixed,
  X,
  CheckCircle2,
  ExternalLink,
  Compass,
  AlertCircle,
  Loader2,
  RotateCw,
  Sparkles,
  Search,
  Navigation,
  ShieldAlert
} from 'lucide-react';
import { Shop, Route } from '../types';

interface AddShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveShop: (shop: Shop) => void;
  existingShops?: Shop[];
  routes?: Route[];
  initialRoute?: string;
  editShop?: Shop | null;
}

// Haversine distance in meters between two coordinates
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Known route coordinates for instant map centering in Gaibandha & across Bangladesh
const KNOWN_ROUTE_COORDS: Record<string, [number, number]> = {
  'পলাশবাড়ী': [25.2847, 89.3456],
  'পলাশবাড়ী': [25.2847, 89.3456],
  'গাইবান্ধা সদর': [25.3297, 89.5430],
  'গাইবান্ধা': [25.3297, 89.5430],
  'তুলসীঘাট': [25.3112, 89.4765],
  'তুলসীঘাট- ঠোলভাঙ্গা': [25.3112, 89.4765],
  'হাসনেরপাড়া': [25.3050, 89.4900],
  'গোবিন্দগঞ্জ': [25.1325, 89.3878],
  'সাদুল্লাপুর': [25.3833, 89.4667],
  'সুন্দরগঞ্জ': [25.5564, 89.5194],
  'ফুলছড়ি': [25.1900, 89.6200],
};

// Deep reverse geocode formatter combining Nominatim + Overpass micro-landmarks (Para, Mor, Bank, Mosque, Market)
function buildDeepBangladeshAddress(
  nominatimData: any,
  overpassElements: any[],
  targetLat: number,
  targetLng: number
): { fullAddress: string; suggestions: string[] } {
  const addr = nominatimData?.address || {};
  const suggestionsSet = new Set<string>();

  // 1. Extract Para / Mohalla / Neighbourhood (যেমন: পলাশপাড়া, মাস্টারপাড়া, কুঠিপাড়া)
  const paraList: string[] = [];
  const nomPara =
    addr.neighbourhood ||
    addr.quarter ||
    addr.suburb ||
    addr.hamlet ||
    addr.isolated_dwelling ||
    addr.residential ||
    addr.village;
  if (nomPara && typeof nomPara === 'string') {
    paraList.push(nomPara.trim());
    suggestionsSet.add(nomPara.trim());
  }

  // 2. Analyze Overpass nearby micro-POIs sorted by distance from exact shop pin
  interface NearbyItem {
    name: string;
    dist: number;
    type: 'mor' | 'landmark' | 'para' | 'road';
    categoryLabel: string;
  }
  const nearbyItems: NearbyItem[] = [];

  if (Array.isArray(overpassElements)) {
    for (const el of overpassElements) {
      const tags = el.tags || {};
      const rawName = (tags['name:bn'] || tags.name || tags['official_name:bn'] || '').trim();
      if (!rawName || rawName.length < 2) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

      const dist = getDistanceMeters(targetLat, targetLng, elLat, elLng);

      const lowerName = rawName.toLowerCase();
      const isMor =
        rawName.includes('মোড়') ||
        rawName.includes('মোড়') ||
        rawName.includes('চত্বর') ||
        rawName.includes('পয়েন্ট') ||
        rawName.includes('পয়েন্ট') ||
        rawName.includes('স্ট্যান্ড') ||
        rawName.includes('বাজার') ||
        rawName.includes('ঘাট') ||
        lowerName.includes('mor') ||
        lowerName.includes('more') ||
        lowerName.includes('chowrasta') ||
        tags.junction !== undefined ||
        tags.highway === 'bus_stop';

      const isPara =
        rawName.includes('পাড়া') ||
        rawName.includes('পাড়া') ||
        rawName.includes('মহল্লা') ||
        ['neighbourhood', 'suburb', 'quarter', 'hamlet', 'village'].includes(tags.place || '');

      const isLandmark =
        tags.amenity !== undefined ||
        tags.office !== undefined ||
        tags.shop !== undefined ||
        tags.building !== undefined ||
        tags.tourism !== undefined ||
        tags.historic !== undefined ||
        rawName.includes('ব্যাংক') ||
        rawName.includes('মসজিদ') ||
        rawName.includes('মাদ্রাসা') ||
        rawName.includes('স্কুল') ||
        rawName.includes('কলেজ') ||
        rawName.includes('হাসপাতাল') ||
        rawName.includes('মার্কেট') ||
        rawName.includes('প্লাজা') ||
        lowerName.includes('bank') ||
        lowerName.includes('mosque') ||
        lowerName.includes('school') ||
        lowerName.includes('college') ||
        lowerName.includes('market') ||
        lowerName.includes('plaza') ||
        lowerName.includes('hospital');

      if (isMor) {
        nearbyItems.push({ name: rawName, dist, type: 'mor', categoryLabel: 'মোড়/বাজার' });
      } else if (isPara) {
        nearbyItems.push({ name: rawName, dist, type: 'para', categoryLabel: 'পাড়া/মহল্লা' });
      } else if (isLandmark && dist <= 130) {
        nearbyItems.push({ name: rawName, dist, type: 'landmark', categoryLabel: 'ল্যান্ডমার্ক' });
      }
    }
  }

  nearbyItems.sort((a, b) => a.dist - b.dist);

  // Add closest Para from Overpass if not already in paraList
  for (const item of nearbyItems.filter((i) => i.type === 'para')) {
    if (!paraList.includes(item.name)) {
      paraList.push(item.name);
    }
    suggestionsSet.add(item.name);
  }

  // Collect Mor / Intersections (যেমন: খন্দকার মোড়, চৌরাস্তা মোড়)
  const morList: string[] = [];
  for (const item of nearbyItems.filter((i) => i.type === 'mor')) {
    if (!morList.includes(item.name)) {
      morList.push(item.name);
    }
    suggestionsSet.add(item.name);
  }

  // Collect Specific Landmarks (যেমন: অগ্রণী ব্যাংক, সোনালী ব্যাংক, জামে মসজিদ)
  const landmarkPhrases: string[] = [];
  // Check if Nominatim itself landed directly on a named POI
  const directPoi =
    nominatimData?.namedetails?.['name:bn'] ||
    nominatimData?.name ||
    addr.amenity ||
    addr.shop ||
    addr.office ||
    addr.building ||
    addr.retail ||
    addr.commercial;

  if (
    directPoi &&
    typeof directPoi === 'string' &&
    directPoi !== nomPara &&
    directPoi !== addr.road &&
    directPoi !== addr.city &&
    directPoi !== addr.town
  ) {
    const cleanDirect = directPoi.trim();
    if (
      cleanDirect.includes('ব্যাংক') ||
      cleanDirect.includes('মসজিদ') ||
      cleanDirect.includes('স্কুল') ||
      cleanDirect.includes('কলেজ') ||
      cleanDirect.includes('মার্কেট') ||
      cleanDirect.includes('প্লাজা') ||
      cleanDirect.includes('হাসপাতাল') ||
      cleanDirect.toLowerCase().includes('bank')
    ) {
      landmarkPhrases.push(`${cleanDirect}-এর সামনে`);
      suggestionsSet.add(`${cleanDirect}-এর সামনে`);
      suggestionsSet.add(`${cleanDirect} সংলগ্ন`);
    } else {
      landmarkPhrases.push(`${cleanDirect} সংলগ্ন`);
      suggestionsSet.add(`${cleanDirect} সংলগ্ন`);
    }
  }

  for (const item of nearbyItems.filter((i) => i.type === 'landmark')) {
    const formattedFront = `${item.name}-এর সামনে`;
    const formattedNear = `${item.name} সংলগ্ন`;
    suggestionsSet.add(formattedFront);
    suggestionsSet.add(formattedNear);

    if (landmarkPhrases.length === 0 && item.dist <= 95) {
      if (item.dist <= 45) {
        landmarkPhrases.push(formattedFront);
      } else {
        landmarkPhrases.push(formattedNear);
      }
    }
  }

  // Road name
  const road = addr.road || addr.street || addr.pedestrian || addr.footway;
  if (road && typeof road === 'string') {
    suggestionsSet.add(road.trim());
  }

  // Town / Upazila / District
  const townOrUpazila =
    addr.town ||
    addr.city ||
    addr.municipality ||
    addr.city_district ||
    addr.subdistrict ||
    addr.county;

  // Assemble the deep address in Bangladesh SR order:
  // [পাড়া/মহল্লা] -> [মোড়/বাজার] -> [ব্যাংক/মসজিদ/প্রতিষ্ঠানের সামনে] -> [রাস্তা] -> [শহর/উপজেলা]
  const finalParts: string[] = [];

  const pushUnique = (val?: string) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    const alreadyExists = finalParts.some(
      (existing) => existing.includes(trimmed) || trimmed.includes(existing)
    );
    if (!alreadyExists) {
      finalParts.push(trimmed);
    }
  };

  if (paraList[0]) pushUnique(paraList[0]);
  if (morList[0]) pushUnique(morList[0]);
  if (landmarkPhrases[0]) pushUnique(landmarkPhrases[0]);
  if (road && typeof road === 'string' && finalParts.length < 3) pushUnique(road);
  if (townOrUpazila && typeof townOrUpazila === 'string') pushUnique(townOrUpazila);

  if (finalParts.length > 0) {
    return {
      fullAddress: finalParts.join(', '),
      suggestions: Array.from(suggestionsSet).slice(0, 8),
    };
  }

  if (nominatimData?.display_name) {
    const rawParts = nominatimData.display_name.split(', ');
    const filtered = rawParts.filter(
      (p: string) =>
        !['বাংলাদেশ', 'Bangladesh', 'রংপুর বিভাগ', 'Rangpur Division', 'ঢাকা বিভাগ'].includes(p.trim()) &&
        !/^\d{4,5}$/.test(p.trim())
    );
    return {
      fullAddress: filtered.slice(0, 4).join(', '),
      suggestions: Array.from(suggestionsSet).slice(0, 8),
    };
  }

  return { fullAddress: '', suggestions: Array.from(suggestionsSet).slice(0, 8) };
}

export const AddShopModal: React.FC<AddShopModalProps> = ({
  isOpen,
  onClose,
  onSaveShop,
  existingShops = [],
  routes = [],
  initialRoute = '',
  editShop = null,
}) => {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [routeArea, setRouteArea] = useState(initialRoute || '');
  const [isCustomRoute, setIsCustomRoute] = useState(false);
  const [customRouteInput, setCustomRouteInput] = useState('');
  const [address, setAddress] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
  const [nearbyLandmarkSuggestions, setNearbyLandmarkSuggestions] = useState<string[]>([]);
  const [category, setCategory] = useState('জেনারেল স্টোর / মুদি');

  // Location State
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccessText, setLocationSuccessText] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Hidden by default so modal looks clean like screenshot; opens when "ম্যাপে পিন বসান" is clicked
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Location Permission & Mobile GPS Disabled Popup State
  const [showLocationPermissionPopup, setShowLocationPermissionPopup] = useState(false);
  const [permissionPopupReason, setPermissionPopupReason] = useState<'denied' | 'gps_off'>('gps_off');

  // Place / Landmark Search inside Map
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchResults, setPlaceSearchResults] = useState<
    Array<{ display_name: string; lat: string; lon: string }>
  >([]);

  // Map Leaflet references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Extract unique existing route names (matching screenshot routes if none set)
  const availableRouteNames = React.useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => {
      if (r.banglaName && r.banglaName.trim()) set.add(r.banglaName.trim());
    });
    existingShops.forEach((s) => {
      if (s.routeArea && s.routeArea.trim()) {
        set.add(s.routeArea.trim());
      }
    });
    if (set.size === 0) {
      set.add('পলাশবাড়ী');
      set.add('তুলসীঘাট- ঠোলভাঙ্গা');
      set.add('গাইবান্ধা সদর');
      set.add('হাসনেরপাড়া');
      set.add('তুলসীঘাট');
    }
    return Array.from(set);
  }, [existingShops, routes]);

  // Deep Reverse Geocode: Nominatim (zoom 18) + Overpass API (micro-landmarks, মোড়, ব্যাংক, পাড়া)
  const fetchAddressFromCoords = useCallback(
    async (latitude: number, longitude: number, overwrite = true) => {
      setIsFetchingAddress(true);
      try {
        const nomController = new AbortController();
        const nomTimeout = setTimeout(() => nomController.abort(), 6500);

        const overpassController = new AbortController();
        const overpassTimeout = setTimeout(() => overpassController.abort(), 4800);

        const overpassQuery = `[out:json][timeout:4];(node(around:160,${latitude},${longitude})["name"];way(around:160,${latitude},${longitude})["name"];node(around:300,${latitude},${longitude})["place"~"neighbourhood|suburb|quarter|hamlet|village|square"];);out center 30;`;

        const [nomRes, overpassRes] = await Promise.all([
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&extratags=1&namedetails=1&accept-language=bn,en`,
            {
              signal: nomController.signal,
              headers: { 'Accept-Language': 'bn,en' },
            }
          ).catch(() => null),
          fetch(
            `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
            {
              signal: overpassController.signal,
            }
          ).catch(() => null),
        ]);

        clearTimeout(nomTimeout);
        clearTimeout(overpassTimeout);

        const nomData = nomRes && nomRes.ok ? await nomRes.json().catch(() => null) : null;
        const overpassJson =
          overpassRes && overpassRes.ok ? await overpassRes.json().catch(() => null) : null;
        const overpassElements = overpassJson?.elements || [];

        const { fullAddress, suggestions } = buildDeepBangladeshAddress(
          nomData,
          overpassElements,
          latitude,
          longitude
        );

        if (suggestions.length > 0) {
          setNearbyLandmarkSuggestions(suggestions);
        }

        if (fullAddress && overwrite) {
          setAddress(fullAddress);
          setAddressAutoFilled(true);
          setLocationSuccessText(`লোকেশন ও ল্যান্ডমার্ক সেট হয়েছে: ${fullAddress}`);
        }
      } catch (err) {
        console.log('Deep reverse geocoding notice:', err);
      } finally {
        setIsFetchingAddress(false);
      }
    },
    []
  );

  // Apply coordinates to state and update map marker
  const applyLocationCoordinates = useCallback(
    (newLat: number, newLng: number, message: string, shouldFetchAddress = true) => {
      const cleanLat = Number(newLat.toFixed(6));
      const cleanLng = Number(newLng.toFixed(6));
      setLat(cleanLat);
      setLng(cleanLng);
      setLocationSuccessText(message);
      setLocationError(null);

      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([cleanLat, cleanLng], 17, { animate: true });
        markerRef.current.setLatLng([cleanLat, cleanLng]);
      }

      if (shouldFetchAddress) {
        fetchAddressFromCoords(cleanLat, cleanLng, true);
      }
    },
    [fetchAddressFromCoords]
  );

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setPlaceSearchResults([]);
      setMapSearchQuery('');
      setNearbyLandmarkSuggestions([]);
      setShowLocationPermissionPopup(false);

      if (editShop) {
        setName(editShop.name || '');
        setOwnerName(editShop.ownerName || '');
        setPhone(editShop.phone || '');
        const existingRoute = editShop.routeArea || '';
        if (existingRoute && !availableRouteNames.includes(existingRoute)) {
          setIsCustomRoute(true);
          setCustomRouteInput(existingRoute);
          setRouteArea(existingRoute);
        } else {
          setIsCustomRoute(false);
          setCustomRouteInput('');
          setRouteArea(existingRoute || availableRouteNames[0] || 'পলাশবাড়ী');
        }
        setAddress(editShop.address || '');
        setAddressAutoFilled(false);
        setIsFetchingAddress(false);
        setCategory(editShop.category || 'জেনারেল স্টোর / মুদি');
        setLat(editShop.lat);
        setLng(editShop.lng);
        setLocationSuccessText(editShop.lat ? 'পূর্বে সংরক্ষিত জিপিএস লোকেশন লোড হয়েছে' : null);
        setLocationError(null);
        setShowMapPicker(false);
      } else {
        setName('');
        setOwnerName('');
        setPhone('');
        const defaultRoute =
          initialRoute ||
          (routes && routes.length > 0 ? routes[0].banglaName : availableRouteNames[0] || 'পলাশবাড়ী');
        setRouteArea(defaultRoute);
        setIsCustomRoute(false);
        setCustomRouteInput('');
        setAddress('');
        setAddressAutoFilled(false);
        setIsFetchingAddress(false);
        setCategory('জেনারেল স্টোর / মুদি');
        setLat(undefined);
        setLng(undefined);
        setLocationSuccessText(null);
        setLocationError(null);
        setShowMapPicker(false);
      }
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    }
  }, [isOpen, editShop]);

  // Determine initial map coordinates (uses saved lat/lng, or selected route in Gaibandha/BD, or Gaibandha default)
  const getInitialMapCenter = useCallback((): [number, number] => {
    if (lat !== undefined && lng !== undefined) {
      return [lat, lng];
    }
    const cleanRoute = routeArea.replace(/রুট/g, '').trim();
    for (const [key, coords] of Object.entries(KNOWN_ROUTE_COORDS)) {
      if (cleanRoute.includes(key) || key.includes(cleanRoute)) {
        return coords;
      }
    }
    // Default to Gaibandha / Palashbari region if no coordinates set yet
    return [25.3297, 89.5430];
  }, [lat, lng, routeArea]);

  // Initialize or destroy Leaflet Map when showMapPicker or isOpen changes
  useEffect(() => {
    if (!isOpen || !showMapPicker) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        return;
      }

      const [startLat, startLng] = getInitialMapCenter();

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: lat && lng ? 17 : 15,
        zoomControl: true,
        fadeAnimation: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      const createPinIcon = () =>
        L.divIcon({
          className: 'custom-shop-add-pin',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: `
            <div style="
              position: relative;
              width: 140px;
              margin-left: -70px;
              margin-top: -48px;
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                background: #047857;
                color: white;
                font-weight: 800;
                font-size: 11px;
                padding: 5px 10px;
                border-radius: 12px;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
                border: 2.5px solid white;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 5px;
                pointer-events: auto;
                cursor: grab;
              ">
                <span>📍 দোকানের অবস্থান</span>
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 10px solid #047857;
                margin-top: -1px;
              "></div>
            </div>
          `,
        });

      const initialMarker = L.marker([startLat, startLng], {
        draggable: true,
        icon: createPinIcon(),
        zIndexOffset: 1000,
      }).addTo(map);

      markerRef.current = initialMarker;

      setTimeout(() => {
        map.invalidateSize();
      }, 250);

      // On map click, move marker and auto-fill deep landmark address
      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickLat = Number(e.latlng.lat.toFixed(6));
        const clickLng = Number(e.latlng.lng.toFixed(6));
        initialMarker.setLatLng([clickLat, clickLng]);
        setLat(clickLat);
        setLng(clickLng);
        setLocationSuccessText(`ম্যাপে পিন বসানো হয়েছে (${clickLat}, ${clickLng})`);
        setLocationError(null);
        fetchAddressFromCoords(clickLat, clickLng, true);
      });

      // On marker drag, move marker and auto-fill deep landmark address
      initialMarker.on('dragend', () => {
        const pos = initialMarker.getLatLng();
        const dragLat = Number(pos.lat.toFixed(6));
        const dragLng = Number(pos.lng.toFixed(6));
        setLat(dragLat);
        setLng(dragLng);
        setLocationSuccessText(`ম্যাপে পিন বসানো হয়েছে (${dragLat}, ${dragLng})`);
        setLocationError(null);
        fetchAddressFromCoords(dragLat, dragLng, true);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [showMapPicker, isOpen, fetchAddressFromCoords, getInitialMapCenter]);

  // Sync marker position when lat/lng state updates externally (GPS or Search)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && lat !== undefined && lng !== undefined) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [lat, lng]);

  // GPS Detection Handler: Shows Location Permission / Turn On GPS Popup if mobile location is OFF or blocked!
  const handleDetectGPS = async () => {
    setIsLocating(true);
    setLocationError(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setIsLocating(false);
      setPermissionPopupReason('gps_off');
      setShowLocationPermissionPopup(true);
      return;
    }

    // Check Permission API first if available
    try {
      if ('permissions' in navigator && navigator.permissions?.query) {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (permStatus.state === 'denied') {
          setIsLocating(false);
          setPermissionPopupReason('denied');
          setShowLocationPermissionPopup(true);
          return;
        }
      }
    } catch {
      // Continue to getCurrentPosition
    }

    // Stage 1: Request High-Accuracy Fresh Device GPS (maximumAge: 0 ensures we detect if mobile GPS is turned off right now)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detectedLat = Number(pos.coords.latitude.toFixed(6));
        const detectedLng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);
        setIsLocating(false);
        setShowLocationPermissionPopup(false);
        applyLocationCoordinates(
          detectedLat,
          detectedLng,
          `বর্তমান জিপিএস লোকেশন পাওয়া গেছে (নির্ভুলতা: ±${accuracy} মি.)`,
          true
        );
      },
      (err) => {
        if (err.code === 1) {
          // PERMISSION_DENIED
          setIsLocating(false);
          setPermissionPopupReason('denied');
          setShowLocationPermissionPopup(true);
          return;
        }

        // Stage 2: Quick retry with standard accuracy in case indoor satellite lock was slow
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            const detectedLat = Number(pos2.coords.latitude.toFixed(6));
            const detectedLng = Number(pos2.coords.longitude.toFixed(6));
            setIsLocating(false);
            setShowLocationPermissionPopup(false);
            applyLocationCoordinates(
              detectedLat,
              detectedLng,
              `বর্তমান জিপিএস লোকেশন সেট হয়েছে (${detectedLat}, ${detectedLng})`,
              true
            );
          },
          (err2) => {
            // Mobile Location / GPS is turned OFF or blocked! Show the Location Permission / Turn On GPS Popup!
            setIsLocating(false);
            setPermissionPopupReason(err2.code === 1 ? 'denied' : 'gps_off');
            setShowLocationPermissionPopup(true);
          },
          {
            enableHighAccuracy: false,
            timeout: 4500,
            maximumAge: 0,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0,
      }
    );
  };

  // Search deep place/mor/bank/market name on map
  const handleSearchPlaceOnMap = async (customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : mapSearchQuery).trim();
    if (!q) return;

    const coordMatch = q.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        applyLocationCoordinates(parsedLat, parsedLng, `স্থানাঙ্ক অনুযায়ী লোকেশন সেট হয়েছে`, true);
        setPlaceSearchResults([]);
        return;
      }
    }

    setIsSearchingPlace(true);
    setLocationError(null);
    setShowMapPicker(true);

    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q + ', Bangladesh'
      )}&limit=6&addressdetails=1&accept-language=bn,en`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          setPlaceSearchResults(results);
          const first = results[0];
          const foundLat = parseFloat(first.lat);
          const foundLng = parseFloat(first.lon);
          if (!isNaN(foundLat) && !isNaN(foundLng)) {
            applyLocationCoordinates(foundLat, foundLng, `ম্যাপে "${q}" এর অবস্থান সেট হয়েছে`, true);
          }
        } else {
          setLocationError(`"${q}" পাওয়া যায়নি। ম্যাপে জুম করে পিন বসান অথবা সরাসরি ল্যান্ডমার্ক লিখুন।`);
        }
      }
    } catch {
      setLocationError('লোকেশন সার্চে সমস্যা হয়েছে। ম্যাপে ক্লিক করে পিন বসান।');
    } finally {
      setIsSearchingPlace(false);
    }
  };

  // Append or set a landmark chip into the address box
  const handleAddLandmarkChip = (chipText: string) => {
    const current = address.trim();
    if (!current) {
      setAddress(chipText);
      return;
    }
    if (current.includes(chipText)) return;
    // Put deep landmark at the front so Mor / Bank is prominent
    setAddress(`${chipText}, ${current}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('দোকানের নাম আবশ্যক');
      return;
    }
    if (!phone.trim()) {
      alert('মোবাইল নম্বর আবশ্যক');
      return;
    }

    const resolvedRoute = isCustomRoute ? customRouteInput.trim() : routeArea.trim();
    if (!resolvedRoute) {
      alert('অনুগ্রহ করে একটি রুট নির্বাচন করুন অথবা নতুন রুটের নাম লিখুন');
      return;
    }

    const savedShop: Shop = {
      ...(editShop
        ? editShop
        : {
            id: `shop-${Date.now()}`,
            previousDue: 0,
            createdAt: new Date().toISOString(),
          }),
      name: name.trim(),
      ownerName: ownerName.trim() || 'মালিক',
      phone: phone.trim(),
      routeArea: resolvedRoute,
      address: address.trim() || `${resolvedRoute} বাজার সংলগ্ন`,
      category: category,
      lastVisitDate: editShop?.lastVisitDate || new Date().toISOString().split('T')[0],
      lat: lat,
      lng: lng,
    };

    onSaveShop(savedShop);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in">
        <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-neutral-200 my-auto max-h-[95vh] overflow-y-auto">
          {/* Top Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-neutral-900 leading-tight">
                  {editShop ? 'দোকানের তথ্য এডিট ও আপডেট' : 'নতুন দোকান যুক্ত করুন'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  দোকানের নাম, রুট, ল্যান্ডমার্ক ও জিপিএস লোকেশন সংরক্ষণ করুন
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {/* 1. দোকানের নাম */}
            <div>
              <label className="font-bold text-neutral-900 block mb-1.5 text-sm">
                দোকানের নাম <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: মেসার্স জনতা স্টোর বা নিউ ঢাকা জেনারেল"
                className="w-full px-3.5 py-3 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-medium text-neutral-900 bg-white text-sm"
              />
            </div>

            {/* 2. মালিক / প্রোপ্রাইটরের নাম (Stacked full-width matching screenshot) */}
            <div>
              <label className="font-bold text-neutral-900 block mb-1.5 text-sm">
                মালিক / প্রোপ্রাইটরের নাম
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="যেমন: হাজী সাইফুল ইসলাম"
                className="w-full px-3.5 py-3 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-medium text-neutral-900 bg-white text-sm"
              />
            </div>

            {/* 3. মোবাইল নম্বর * (Stacked full-width matching screenshot) */}
            <div>
              <label className="font-bold text-neutral-900 block mb-1.5 text-sm">
                মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="০১৭১xxxxxxx"
                className="w-full px-3.5 py-3 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-medium text-neutral-900 bg-white text-sm"
              />
            </div>

            {/* 4. রুট নির্বাচন করুন (Select Route) * (Exact screenshot layout) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="font-bold text-neutral-900 flex items-center gap-2 text-sm leading-snug">
                  <Compass className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    রুট নির্বাচন করুন (Select Route) <span className="text-rose-500">*</span>
                  </span>
                </label>
                <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0 leading-tight">
                  ড্রপডাউন থেকে বেছে
                  <br />
                  নিন
                </span>
              </div>

              <select
                value={isCustomRoute ? '__CUSTOM__' : routeArea}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__CUSTOM__') {
                    setIsCustomRoute(true);
                    setRouteArea('');
                  } else {
                    setIsCustomRoute(false);
                    setRouteArea(val);
                  }
                }}
                className="w-full px-3.5 py-3 border-2 border-emerald-600/50 rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-bold text-neutral-900 bg-emerald-50/40 text-sm shadow-2xs cursor-pointer"
              >
                <option value="" disabled>
                  -- রুট সিলেক্ট করুন --
                </option>
                {availableRouteNames.map((r) => (
                  <option key={r} value={r}>
                    📍 {r}
                  </option>
                ))}
                <option value="__CUSTOM__">➕ নতুন রুট লিখুন (কাস্টম রুট)...</option>
              </select>

              {isCustomRoute && (
                <div className="mt-2.5 p-3 bg-amber-50/70 border border-amber-300 rounded-2xl animate-in fade-in">
                  <label className="text-xs font-bold text-amber-900 block mb-1">
                    নতুন রুটের নাম লিখুন:
                  </label>
                  <input
                    type="text"
                    required
                    value={customRouteInput}
                    onChange={(e) => {
                      setCustomRouteInput(e.target.value);
                      setRouteArea(e.target.value);
                    }}
                    placeholder="যেমন: পলাশবাড়ী, গাইবান্ধা সদর, তুলসীঘাট..."
                    autoFocus
                    className="w-full p-2.5 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-neutral-900 bg-white text-sm"
                  />
                </div>
              )}

              {availableRouteNames.length > 0 && (
                <div className="mt-2.5">
                  <span className="text-xs text-neutral-500 font-semibold block mb-2">
                    অথবা সরাসরি বাটন চেপে সিলেক্ট করুন:
                  </span>
                  <div className="flex flex-wrap gap-2 items-center">
                    {availableRouteNames.map((r) => {
                      const isSelected = !isCustomRoute && routeArea === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setIsCustomRoute(false);
                            setRouteArea(r);
                          }}
                          className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                              : 'bg-white text-neutral-800 border-neutral-300 hover:border-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRoute(true);
                        setRouteArea('');
                      }}
                      className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                        isCustomRoute
                          ? 'bg-amber-500 text-neutral-950 border-amber-600'
                          : 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      + নতুন রুট
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. দোকানের ঠিকানা / ল্যান্ডমার্ক (Placed ABOVE the green Map box just like screenshot, with Deep Landmark auto-fill!) */}
            <div>
              <div className="mb-1.5">
                <label className="font-bold text-neutral-900 flex items-center gap-1.5 text-sm">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>দোকানের ঠিকানা / ল্যান্ডমার্ক</span>
                </label>
                <div className="flex items-center justify-between mt-0.5">
                  {isFetchingAddress ? (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>গভীর থেকে মোড় ও ল্যান্ডমার্ক ঠিকানা খোঁজা হচ্ছে...</span>
                    </span>
                  ) : addressAutoFilled ? (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>জিপিএস/ম্যাপ থেকে গভীর ল্যান্ডমার্ক অটো বসেছে</span>
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500 font-medium">
                      ম্যাপে ক্লিক করলে ঠিকানা অটো বসবে
                    </span>
                  )}

                  {lat && lng && (
                    <button
                      type="button"
                      onClick={() => fetchAddressFromCoords(lat, lng, true)}
                      disabled={isFetchingAddress}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className={`w-3 h-3 ${isFetchingAddress ? 'animate-spin' : ''}`} />
                      <span>অটো রিফ্রেশ</span>
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressAutoFilled(false);
                }}
                placeholder="ম্যাপে ক্লিক করলে বা জিপিএস অন করলে (যেমন: পলাশপাড়া খন্দকার মোড়, অগ্রণী ব্যাংকের সামনে)"
                className={`w-full px-3.5 py-3 border rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-medium text-neutral-900 text-sm transition-all ${
                  addressAutoFilled
                    ? 'bg-emerald-50/40 border-emerald-500 font-bold'
                    : 'border-neutral-300 bg-white'
                }`}
              />

              {/* Deep Nearby Landmark & Mor Suggestions (One-Click Append/Select) */}
              {nearbyLandmarkSuggestions.length > 0 && (
                <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>আশেপাশের চিহ্নিত মোড়, পাড়া ও ল্যান্ডমার্ক (ক্লিক করলেই যোগ হবে):</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {nearbyLandmarkSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddLandmarkChip(sug)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-700 text-emerald-900 hover:text-white border border-emerald-300 font-bold transition cursor-pointer shadow-2xs"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 6. ম্যাপসে দোকানের লোকেশন সেট করুন (Exact Green Card with 2 Side-by-Side White Buttons from Screenshot) */}
            <div className="p-4 bg-emerald-50/70 rounded-3xl border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span className="font-bold text-neutral-900 text-sm leading-snug">
                    ম্যাপসে দোকানের লোকেশন সেট
                    <br />
                    করুন
                  </span>
                </div>
                {lat && lng ? (
                  <span className="text-[11px] font-bold bg-emerald-700 text-white px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> লোকেশন সেট
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500 font-medium text-right leading-tight shrink-0">
                    ঐচ্ছিক কিন্তু
                    <br />
                    সুপারিশকৃত
                  </span>
                )}
              </div>

              {/* Two Side-by-Side White Card Buttons Matching Screenshot */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Button 1: বর্তমান জিপিএস লোকেশন নিন */}
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={isLocating}
                  className="py-3.5 px-2.5 bg-white hover:bg-emerald-50/80 border border-emerald-300 rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98 disabled:opacity-60"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                  <span className="font-extrabold text-emerald-900 text-xs sm:text-sm leading-snug text-center">
                    {isLocating ? (
                      'জিপিএস নেওয়া হচ্ছে...'
                    ) : (
                      <>
                        📍 বর্তমান
                        <br />
                        জিপিএস লোকেশন
                        <br />
                        নিন
                      </>
                    )}
                  </span>
                </button>

                {/* Button 2: ম্যাপে পিন বসান */}
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className={`py-3.5 px-2.5 bg-white hover:bg-neutral-50 border rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98 ${
                    showMapPicker ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-neutral-200'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-neutral-800 shrink-0" />
                  <span className="font-extrabold text-neutral-900 text-xs sm:text-sm leading-snug text-center">
                    🗺️ {showMapPicker ? 'ম্যাপ লুকান' : 'ম্যাপে পিন বসান'}
                  </span>
                </button>
              </div>

              {/* Status Feedback if Location Set */}
              {locationSuccessText && (
                <div className="text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2 bg-white/90 p-2.5 rounded-xl border border-emerald-300">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                    <span className="truncate">{locationSuccessText}</span>
                  </div>
                  {lat && lng && (
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline font-bold text-[11px] shrink-0 flex items-center gap-0.5"
                    >
                      <span>ম্যাপস</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {locationError && (
                <p className="text-xs text-rose-700 font-medium flex items-center gap-1.5 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{locationError}</span>
                </p>
              )}

              {/* Interactive Map & Deep Landmark Search (Opens when "ম্যাপে পিন বসান" is clicked) */}
              {showMapPicker && (
                <div className="space-y-2.5 pt-2 border-t border-emerald-200/70 animate-in fade-in">
                  {/* Search Box for Mor / Bank / Market */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={mapSearchQuery}
                        onChange={(e) => setMapSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchPlaceOnMap();
                          }
                        }}
                        placeholder="মোড়, ব্যাংক বা এলাকার নাম খুঁজুন (যেমন: পলাশপাড়া, গাইবান্ধা)..."
                        className="w-full pl-8 pr-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSearchPlaceOnMap()}
                      disabled={isSearchingPlace}
                      className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      {isSearchingPlace ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>খুঁজুন</span>
                    </button>
                  </div>

                  {placeSearchResults.length > 1 && (
                    <div className="bg-white rounded-xl border border-emerald-200 p-1.5 space-y-1 max-h-28 overflow-y-auto">
                      {placeSearchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const fLat = parseFloat(item.lat);
                            const fLng = parseFloat(item.lon);
                            applyLocationCoordinates(fLat, fLng, `ম্যাপে লোকেশন সেট হয়েছে`, true);
                            setPlaceSearchResults([]);
                          }}
                          className="w-full text-left px-2 py-1 rounded-lg hover:bg-emerald-50 text-[11px] text-neutral-800 flex items-center gap-1.5 truncate cursor-pointer"
                        >
                          <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-emerald-900 font-bold">
                    👇 ম্যাপে দোকানের মোড় বা অবস্থানের ওপর টাচ করুন (ঠিকানা ও ল্যান্ডমার্ক অটো বসবে):
                  </p>
                  <div
                    ref={mapContainerRef}
                    className="w-full h-56 rounded-2xl border-2 border-emerald-600 shadow-inner overflow-hidden z-10 bg-neutral-100"
                  />
                </div>
              )}
            </div>

            {/* 7. Bottom Action Buttons Matching Screenshot */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 text-neutral-800 hover:bg-neutral-100 rounded-2xl font-extrabold text-sm transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 py-3.5 px-5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-900/15 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="leading-snug text-center">
                  {editShop ? 'আপডেট সংরক্ষণ করুন' : 'দোকান ও লোকেশন সংরক্ষণ করুন'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MOBILE LOCATION OFF / LOCATION PERMISSION POPUP MODAL */}
      {showLocationPermissionPopup && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-amber-200 text-center space-y-4 relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowLocationPermissionPopup(false)}
              className="absolute top-3.5 right-3.5 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center mx-auto shadow-lg ring-8 ring-amber-50">
              <LocateFixed className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full">
                {permissionPopupReason === 'denied' ? 'লোকেশন পারমিশন প্রয়োজন' : 'মোবাইলের জিপিএস বন্ধ'}
              </span>
              <h3 className="text-lg font-black text-neutral-900">
                {permissionPopupReason === 'denied'
                  ? 'লোকেশন পারমিশন (Allow) চালু করুন!'
                  : 'মোবাইলের লোকেশন (GPS) চালু করুন!'}
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {permissionPopupReason === 'denied'
                  ? 'দোকানের বর্তমান জিপিএস লোকেশন ও মোড়ের ল্যান্ডমার্ক ঠিকানা অটোমেটিক বসাতে ব্রাউজারের লোকেশন পারমিশন Allow করুন।'
                  : 'আপনার মোবাইলের Location (GPS) অপশনটি বর্তমানে বন্ধ আছে। জিপিএস লোকেশন নিতে ফোনের লোকেশন অন করুন।'}
              </p>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 text-left text-xs text-neutral-800 space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  ১
                </span>
                <span>
                  মোবাইলের উপর থেকে শাটার নামিয়ে <strong className="text-emerald-800">Location / GPS</strong> আইকনটি <strong>অন (চালু)</strong> করুন।
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  ২
                </span>
                <span>
                  ব্রাউজারের পপআপে বা অ্যাড্রেস বারের পাশে 🔒 আইকনে ক্লিক করে Location পারমিশন <strong className="text-emerald-800">"Allow" (অনুমতি দিন)</strong> করুন।
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowLocationPermissionPopup(false);
                  handleDetectGPS();
                }}
                className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <LocateFixed className="w-4 h-4 text-emerald-200" />
                <span>লোকেশন অন করেছি — পুনরায় জিপিএস নিন</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationPermissionPopup(false);
                    setShowMapPicker(true);
                  }}
                  className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs cursor-pointer transition"
                >
                  🗺️ ম্যাপে পিন বসান
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationPermissionPopup(false)}
                  className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer transition"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
