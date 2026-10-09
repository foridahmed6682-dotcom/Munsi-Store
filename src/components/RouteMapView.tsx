import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation as NavIcon,
  Phone,
  Store,
  DollarSign,
  Search,
  Layers,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  LocateFixed,
  Radio,
  Play,
  Pause,
  Zap,
  Bike,
  Footprints,
  Target,
  Eye,
  Volume2,
  VolumeX,
  CornerUpLeft,
  CornerUpRight,
  MoveUp,
  List,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { Shop, PaymentMethod, Route } from '../types';

export interface NavigationTurnStep {
  id: string;
  instruction: string;
  modifier: string; // 'left' | 'right' | 'slight-left' | 'slight-right' | 'straight' | 'uturn' | 'arrive'
  distanceMeters: number;
  roadName: string;
  lat: number;
  lng: number;
}

// Gentle audio chime for turn announcements
const playTurnChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {}
};

// Bengali speech synthesis for turn-by-turn guidance
const speakInstruction = (text: string, isMuted: boolean) => {
  if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'bn-BD';
    utterance.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const bn = voices.find((v) => v.lang.includes('bn') || v.lang.includes('BD'));
    if (bn) utterance.voice = bn;
    window.speechSynthesis.speak(utterance);
  } catch {}
};

// Maneuver Turn Arrow Icon helper
const renderManeuverIcon = (modifier: string, className = 'w-7 h-7 text-white') => {
  if (modifier === 'arrive') {
    return <CheckCircle2 className={`${className} text-emerald-300`} />;
  }
  if (modifier.includes('left')) {
    return <CornerUpLeft className={className} />;
  }
  if (modifier.includes('right')) {
    return <CornerUpRight className={className} />;
  }
  if (modifier.includes('uturn')) {
    return <CornerUpLeft className={`${className} rotate-180`} />;
  }
  return <MoveUp className={className} />;
};

interface RouteMapViewProps {
  shops: Shop[];
  routes?: Route[];
  targetShopId?: string | null;
  onClearTargetShop?: () => void;
  onSelectShopForOrder: (shopId: string) => void;
  onRecordDuePayment: (shopId: string, amount: number, method: PaymentMethod, notes?: string) => void;
  onUpdateShopCoordinates?: (shopId: string, lat: number, lng: number) => void;
}

// Known route coordinates in Gaibandha & Palashbari region for shops without exact GPS pins
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

function getRouteCenterCoords(routeName?: string): [number, number] {
  if (!routeName || routeName === 'all') return [25.3050, 89.4500];
  const clean = routeName.replace(/রুট/g, '').trim();
  for (const [key, coords] of Object.entries(KNOWN_ROUTE_COORDS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }
  return [25.2847, 89.3456];
}

function getShopCoordinates(shop: Shop, index = 0): [number, number] {
  if (typeof shop.lat === 'number' && typeof shop.lng === 'number' && !isNaN(shop.lat) && !isNaN(shop.lng)) {
    return [shop.lat, shop.lng];
  }
  const [baseLat, baseLng] = getRouteCenterCoords(shop.routeArea);
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = 0.0012 * ((index % 5) + 1);
  return [
    Number((baseLat + Math.cos(angle) * radius).toFixed(6)),
    Number((baseLng + Math.sin(angle) * radius).toFixed(6)),
  ];
}

// Calculate distance between two coordinates in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate compass bearing from point 1 to point 2 in degrees (0 = North, 90 = East)
function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Convert bearing degrees to Bengali compass direction name
function getCompassDirectionName(deg: number): string {
  const directions = [
    'উত্তর (North)',
    'উত্তর-পূর্ব (NE)',
    'পূর্ব (East)',
    'দক্ষিণ-পূর্ব (SE)',
    'দক্ষিণ (South)',
    'দক্ষিণ-পশ্চিম (SW)',
    'পশ্চিম (West)',
    'উত্তর-পশ্চিম (NW)',
  ];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

export const RouteMapView: React.FC<RouteMapViewProps> = ({
  shops,
  routes: configuredRoutes = [],
  targetShopId = null,
  onClearTargetShop,
  onSelectShopForOrder,
  onRecordDuePayment,
  onUpdateShopCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'DUE' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [directionDistanceText, setDirectionDistanceText] = useState<string | null>(null);

  // Map layer type: Free Street Map vs Free Satellite (showing real houses, roofs and buildings)
  const [mapLayerType, setMapLayerType] = useState<'streets' | 'satellite'>('streets');
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);

  // 2-Second Live Navigation & Direction tracking
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(true);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [liveDistanceMeters, setLiveDistanceMeters] = useState<number | null>(null);
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number>(0);
  const [liveHeadingDeg, setLiveHeadingDeg] = useState<number | null>(null);
  const [lastTickTime, setLastTickTime] = useState<number>(() => Date.now());
  const [liveHeartbeat, setLiveHeartbeat] = useState<boolean>(false);
  const liveIntervalRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // Turn-by-Turn GPS Navigation Mode (Driver Mode)
  const [isTurnByTurnActive, setIsTurnByTurnActive] = useState<boolean>(false);
  const [isBottomCardMinimized, setIsBottomCardMinimized] = useState<boolean>(false);
  const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
  const [turnSteps, setTurnSteps] = useState<NavigationTurnStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [showStepsModal, setShowStepsModal] = useState<boolean>(false);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);
  const hasAnnouncedArrivalRef = useRef<boolean>(false);

  // User live geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isUpdatingGPS, setIsUpdatingGPS] = useState<boolean>(false);

  // Due collection modal inside map
  const [isDueModalOpen, setIsDueModalOpen] = useState<boolean>(false);
  const [dueAmount, setDueAmount] = useState<string>('');
  const [dueMethod, setDueMethod] = useState<PaymentMethod>('CASH');

  // Filter routes
  const routes = useMemo(() => {
    const set = new Set<string>();
    if (configuredRoutes && configuredRoutes.length > 0) {
      configuredRoutes.forEach((r) => set.add(r.banglaName));
    }
    shops.forEach((s) => {
      if (s.routeArea) set.add(s.routeArea);
    });
    return Array.from(set);
  }, [shops, configuredRoutes]);

  // Filtered shops
  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchRoute = selectedRoute === 'all' || s.routeArea === selectedRoute;
      const matchDue =
        dueFilter === 'ALL'
          ? true
          : dueFilter === 'DUE'
          ? s.previousDue > 0
          : s.previousDue === 0;
      const matchSearch =
        searchQuery === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRoute && matchDue && matchSearch;
    });
  }, [shops, selectedRoute, dueFilter, searchQuery]);

  // Nearest shops sorted by distance if user location is known
  const nearestShops = useMemo(() => {
    if (!userLocation) return [];
    return [...filteredShops]
      .filter((s) => s.lat !== undefined && s.lng !== undefined)
      .map((s) => ({
        ...s,
        distanceKm: calculateDistanceKm(userLocation.lat, userLocation.lng, s.lat!, s.lng!),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [filteredShops, userLocation]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default to Gaibandha-Palashbari hub center
      const map = L.map(mapContainerRef.current, {
        center: [25.3050, 89.4500],
        zoom: 12,
        zoomControl: false,
      });

      // Default Standard OpenStreetMap Free Tiles
      const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      baseTileLayerRef.current = baseLayer;

      // Custom zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // When user manually drags the map, pause auto-follow camera
      map.on('dragstart', () => {
        setAutoFollow(false);
      });

      // When user taps on map, minimize card so the route and map are fully visible
      map.on('click', () => {
        setIsBottomCardMinimized(true);
      });
    }

    return () => {
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate map size whenever fullscreen, turn-by-turn or card minimize state changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isFullScreenMap, isTurnByTurnActive, isBottomCardMinimized]);

  // Switch Tile Layer between Free Street Map and Free Satellite (shows actual houses, roofs & roads)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelsTileLayerRef.current) {
      map.removeLayer(labelsTileLayerRef.current);
      labelsTileLayerRef.current = null;
    }

    if (mapLayerType === 'satellite') {
      // Free Esri World Imagery Satellite Tiles - Shows real roofs, buildings, trees and houses
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri & Earthstar Geographics',
          maxZoom: 19,
        }
      ).addTo(map);
      baseTileLayerRef.current = satLayer;

      // Overlay road & place labels on top of satellite
      const labelLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri World Labels',
          maxZoom: 19,
        }
      ).addTo(map);
      labelsTileLayerRef.current = labelLayer;
    } else {
      // Free OpenStreetMap Standard
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      baseTileLayerRef.current = streetLayer;
    }
  }, [mapLayerType]);

  // Update Markers when filteredShops change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    filteredShops.forEach((shop, idx) => {
      // Resolve exact or route-based coordinates
      const [lat, lng] = getShopCoordinates(shop, idx);

      bounds.push([lat, lng]);

      // Custom HTML Pin Marker based on due amount
      const isHighDue = shop.previousDue > 6000;
      const hasDue = shop.previousDue > 0;
      const pinColor = isHighDue ? '#e11d48' : hasDue ? '#f59e0b' : '#059669';
      const badgeText = hasDue ? `৳${(shop.previousDue / 1000).toFixed(0)}k` : '✓';

      const customIcon = L.divIcon({
        className: 'custom-shop-pin',
        html: `
          <div style="
            position: relative;
            transform: translate(-50%, -100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          ">
            <div style="
              background: ${pinColor};
              color: white;
              font-weight: 800;
              font-size: 11px;
              padding: 4px 8px;
              border-radius: 12px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
              border: 2px solid white;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span>${shop.name.slice(0, 14)}...</span>
              <span style="background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 6px; font-size: 10px;">${badgeText}</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid ${pinColor};
            "></div>
          </div>
        `,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedShop(shop);
        map.panTo([lat, lng], { animate: true });
      });

      marker.addTo(layer);
    });

    // Auto-fit bounds if we have shop locations, otherwise pan to selected route center
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (selectedRoute !== 'all') {
      const routeCoords = getRouteCenterCoords(selectedRoute);
      map.setView(routeCoords, 14, { animate: true });
    }
  }, [filteredShops, selectedRoute]);

  const applyUserLocationOnMap = (latitude: number, longitude: number, speedKm = 0, shouldCenter = false) => {
    setUserLocation({ lat: latitude, lng: longitude });
    setLiveSpeedKmh(speedKm);
    setLastTickTime(Date.now());
    setLiveHeartbeat((p) => !p);

    const map = mapInstanceRef.current;
    if (map) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([latitude, longitude]);
      } else {
        const userIcon = L.divIcon({
          className: 'user-live-pin',
          html: `
            <div style="
              width: 20px;
              height: 20px;
              background: #2563eb;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 14px rgba(37, 99, 235, 0.8);
              position: relative;
            ">
              <div style="
                position: absolute;
                inset: -8px;
                border-radius: 50%;
                border: 2px solid #3b82f6;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
        marker.bindPopup('<b>আপনার বর্তমান অবস্থান (Live GPS)</b>');
        userMarkerRef.current = marker;
      }

      if (shouldCenter || (autoFollow && selectedShop)) {
        map.panTo([latitude, longitude], { animate: true });
      }
    }

    // Auto-update live distance and direction polyline if a shop is currently active!
    if (selectedShop) {
      const [sLat, sLng] = getShopCoordinates(selectedShop, 0);
      const distKm = calculateDistanceKm(latitude, longitude, sLat, sLng);
      const meters = Math.round(distKm * 1000);
      setLiveDistanceMeters(meters);
      const text = meters < 1000 ? `${meters} মিটার` : `${distKm.toFixed(2)} কিমি`;
      setDirectionDistanceText(text);

      const bearing = calculateBearingDegrees(latitude, longitude, sLat, sLng);
      setLiveHeadingDeg(bearing);

      // Turn-by-Turn Maneuver Step Progress & Speech Guidance
      if (isTurnByTurnActive && turnSteps.length > 0) {
        const activeStep = turnSteps[currentStepIndex];
        if (activeStep) {
          const stepDistM = Math.round(
            calculateDistanceKm(latitude, longitude, activeStep.lat, activeStep.lng) * 1000
          );
          if (stepDistM <= 40 && currentStepIndex < turnSteps.length - 1) {
            const nextIdx = currentStepIndex + 1;
            setCurrentStepIndex(nextIdx);
            playTurnChime();
            speakInstruction(turnSteps[nextIdx].instruction, isVoiceMuted);
          }
        }
      }

      // Arrival Announcement (< 35 meters)
      if (meters <= 35 && !hasAnnouncedArrivalRef.current) {
        hasAnnouncedArrivalRef.current = true;
        playTurnChime();
        speakInstruction(`অভিনন্দন! আপনি ${selectedShop.name}-এ পৌঁছে গেছেন।`, isVoiceMuted);
      }

      // If simple polyline exists and no multi-point road steps, update endpoints
      if (!turnSteps.length && routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([
          [latitude, longitude],
          [sLat, sLng],
        ]);
      }
    }
  };

  // 2-Second Live Navigation & Direction GPS Update Engine
  useEffect(() => {
    if (!isLiveTracking) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }

    const fetchGpsTick = (highAcc = true) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          applyUserLocationOnMap(pos.coords.latitude, pos.coords.longitude, spd);
        },
        () => {
          // Low accuracy retry on timeout
          navigator.geolocation?.getCurrentPosition(
            (pos2) => {
              applyUserLocationOnMap(pos2.coords.latitude, pos2.coords.longitude);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 3500, maximumAge: 10000 }
          );
        },
        { enableHighAccuracy: highAcc, timeout: 3500, maximumAge: 1800 }
      );
    };

    // Immediate initial ping
    fetchGpsTick(true);

    // Watch position for OS-level movement updates
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
            applyUserLocationOnMap(pos.coords.latitude, pos.coords.longitude, spd);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 1800 }
        );
      } catch {
        // ignore
      }
    }

    // 2-Second Interval: guaranteed update every 2000 milliseconds
    liveIntervalRef.current = setInterval(() => {
      fetchGpsTick(true);
    }, 2000);

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [isLiveTracking, selectedShop?.id]);

  // Locate User with multi-stage fallback
  const handleLocateMe = () => {
    setIsLocating(true);
    setLocationError(null);

    const tryIPFallback = async () => {
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (res.ok) {
          const data = await res.json();
          const ipLat = parseFloat(data.latitude);
          const ipLng = parseFloat(data.longitude);
          if (!isNaN(ipLat) && !isNaN(ipLng)) {
            setIsLocating(false);
            applyUserLocationOnMap(ipLat, ipLng);
            return;
          }
        }
      } catch {
        // ignore
      }
      setIsLocating(false);
      setLocationError('লোকেশন পাওয়া যায়নি। অনুগ্রহ করে ডিভাইসের GPS অন করুন।');
    };

    if (!navigator.geolocation) {
      tryIPFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        applyUserLocationOnMap(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            setIsLocating(false);
            applyUserLocationOnMap(pos2.coords.latitude, pos2.coords.longitude);
          },
          () => {
            tryIPFallback();
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  // High Accuracy Shop GPS Position Updater with fallback
  const handleUpdateShopGPS = (shopId: string) => {
    if (!navigator.geolocation) {
      alert('আপনার ডিভাইসে জিপিএস সাপোর্ট নেই');
      return;
    }

    const applyShopGPS = (latitude: number, longitude: number) => {
      setIsUpdatingGPS(false);
      const preciseLat = Number(latitude.toFixed(6));
      const preciseLng = Number(longitude.toFixed(6));

      if (onUpdateShopCoordinates) {
        onUpdateShopCoordinates(shopId, preciseLat, preciseLng);
        setSelectedShop((prev) =>
          prev && prev.id === shopId ? { ...prev, lat: preciseLat, lng: preciseLng } : prev
        );
        setUserLocation({ lat: preciseLat, lng: preciseLng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([preciseLat, preciseLng], 17);
        }
      }
    };

    setIsUpdatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyShopGPS(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            applyShopGPS(pos2.coords.latitude, pos2.coords.longitude);
          },
          (err) => {
            setIsUpdatingGPS(false);
            let msg = 'জিপিএস লোকেশন রিড করা যায়নি।';
            if (err.code === 1) {
              msg = 'লোকেশন পারমিশন ডিনাই করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংসে জিপিএস অনুমতি দিন।';
            } else if (err.code === 2) {
              msg = 'ফোনের জিপিএস সিগন্যাল পাওয়া যাচ্ছে না।';
            } else if (err.code === 3) {
              msg = 'জিপিএস রিকোয়েস্ট টাইমআউট হয়েছে।';
            }
            alert(msg);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  // Automatically focus shop if targetShopId is provided
  useEffect(() => {
    if (targetShopId) {
      const found = shops.find((s) => s.id === targetShopId);
      if (found) {
        if (selectedRoute !== 'all' && found.routeArea !== selectedRoute) {
          setSelectedRoute('all');
        }
        setSelectedShop(found);
        setIsBottomCardMinimized(true); // Auto-minimize card so turn-by-turn navigation is clearly visible on mobile!
        const [fLat, fLng] = getShopCoordinates(found, 0);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([fLat, fLng], 16, { animate: true });
        }
        if (userLocation) {
          const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, fLat, fLng);
          const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
          setDirectionDistanceText(text);
          drawDirectionRoute({ ...found, lat: fLat, lng: fLng }, true);
        }
      }
    }
  }, [targetShopId, shops, userLocation]);

  // Fetch real road route & turn-by-turn steps from free OSRM service or intelligent fallback
  const fetchRoadRouteAndSteps = async (
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
    shopName: string
  ): Promise<{ coordinates: [number, number][]; steps: NavigationTurnStep[] }> => {
    setIsRoutingLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OSRM API status ' + res.status);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        const rawSteps = route.legs?.[0]?.steps || [];
        const steps: NavigationTurnStep[] = rawSteps.map((st: any, i: number) => {
          const type = st.maneuver?.type || 'turn';
          const modifier = st.maneuver?.modifier || 'straight';
          const road = st.name || '';
          let instruction = '';

          if (type === 'depart') {
            instruction = road ? `${road}-এ যাত্রা শুরু করুন` : 'যাত্রা শুরু করে সোজা এগোন';
          } else if (type === 'arrive') {
            instruction = `গন্তব্যে পৌঁছে গেছেন (${shopName})`;
          } else if (modifier.includes('left')) {
            instruction = modifier.includes('slight') ? 'হালকা বামে মোড় নিন' : 'বামে মোড় নিন';
            if (road) instruction += ` (${road})`;
          } else if (modifier.includes('right')) {
            instruction = modifier.includes('slight') ? 'হালকা ডানে মোড় নিন' : 'ডানে মোড় নিন';
            if (road) instruction += ` (${road})`;
          } else if (modifier === 'uturn') {
            instruction = 'ইউ-টার্ন নিয়ে ঘুরে যান';
          } else {
            instruction = road ? `${road}-এ সোজা চলুন` : 'সোজা এগিয়ে যান';
          }

          return {
            id: `step-${i}`,
            instruction,
            modifier: type === 'arrive' ? 'arrive' : modifier,
            distanceMeters: Math.round(st.distance || 0),
            roadName: road || 'প্রধান সড়ক',
            lat: st.maneuver?.location?.[1] || startLat,
            lng: st.maneuver?.location?.[0] || startLng,
          };
        });

        return { coordinates, steps };
      }
    } catch (e) {
      console.warn('OSRM routing fallback used:', e);
    } finally {
      setIsRoutingLoading(false);
    }

    // Direct fallback steps if OSRM is slow or offline
    const distM = Math.round(calculateDistanceKm(startLat, startLng, destLat, destLng) * 1000);
    const bearing = calculateBearingDegrees(startLat, startLng, destLat, destLng);
    const dir = getCompassDirectionName(bearing);
    const fallbackSteps: NavigationTurnStep[] = [
      {
        id: 'step-0',
        instruction: `${dir} অভিমুখে যাত্রা শুরু করুন`,
        modifier: 'straight',
        distanceMeters: Math.max(50, Math.round(distM * 0.4)),
        roadName: 'প্রধান সংযোগ সড়ক',
        lat: startLat,
        lng: startLng,
      },
      {
        id: 'step-1',
        instruction: `দোকানের সংযোগ সড়কে অগ্রসর হোন (${dir})`,
        modifier: 'straight',
        distanceMeters: Math.max(50, Math.round(distM * 0.4)),
        roadName: 'বাজার সড়ক',
        lat: Number(((startLat + destLat) / 2).toFixed(6)),
        lng: Number(((startLng + destLng) / 2).toFixed(6)),
      },
      {
        id: 'step-2',
        instruction: `গন্তব্য (${shopName}) সামনেই অবস্থান করছে`,
        modifier: 'arrive',
        distanceMeters: Math.max(20, Math.round(distM * 0.2)),
        roadName: shopName,
        lat: destLat,
        lng: destLng,
      },
    ];

    return {
      coordinates: [
        [startLat, startLng],
        [destLat, destLng],
      ],
      steps: fallbackSteps,
    };
  };

  // Draw visual navigation polyline on map and start Turn-by-Turn GPS navigation
  const drawDirectionRoute = async (shop: Shop, activateTurnByTurn = true) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsLiveTracking(true); // Automatically ensure 2-second live GPS tracking is active
    setAutoFollow(true); // Automatically lock camera to user's movement for live turn-by-turn tracking
    hasAnnouncedArrivalRef.current = false;

    const [sLat, sLng] = getShopCoordinates(shop, 0);

    // Clear previous polyline
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!userLocation) {
      handleLocateMe();
      return;
    }

    const { coordinates, steps } = await fetchRoadRouteAndSteps(
      userLocation.lat,
      userLocation.lng,
      sLat,
      sLng,
      shop.name
    );

    const polyline = L.polyline(coordinates, {
      color: '#059669', // Emerald/green turn-by-turn road route
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    });

    polyline.addTo(map);
    routePolylineRef.current = polyline;

    map.fitBounds(polyline.getBounds(), { padding: [70, 70], maxZoom: 17 });

    setTurnSteps(steps);
    setCurrentStepIndex(0);

    if (activateTurnByTurn) {
      setIsTurnByTurnActive(true);
      setIsBottomCardMinimized(true); // Auto-minimize shop card to ensure turn-by-turn navigation is clearly visible on mobile!
      playTurnChime();
      if (steps.length > 0) {
        speakInstruction(`যাত্রা শুরু করুন। ${steps[0].instruction}`, isVoiceMuted);
      }
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, sLat, sLng);
    const meters = Math.round(dist * 1000);
    setLiveDistanceMeters(meters);
    const text = meters < 1000 ? `${meters} মিটার` : `${dist.toFixed(2)} কিমি`;
    setDirectionDistanceText(text);

    const bearing = calculateBearingDegrees(userLocation.lat, userLocation.lng, sLat, sLng);
    setLiveHeadingDeg(bearing);
  };

  // Close selected shop drawer and clear polyline
  const handleCloseSelectedShop = () => {
    setSelectedShop(null);
    setDirectionDistanceText(null);
    setLiveDistanceMeters(null);
    setLiveHeadingDeg(null);
    setIsTurnByTurnActive(false);
    setIsBottomCardMinimized(false);
    setTurnSteps([]);
    setCurrentStepIndex(0);
    setShowStepsModal(false);
    hasAnnouncedArrivalRef.current = false;
    if (onClearTargetShop) onClearTargetShop();
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  };

  // Focus a specific shop on the map
  const handleFocusShop = (shop: Shop) => {
    setSelectedShop(shop);
    setIsBottomCardMinimized(false);
    const [sLat, sLng] = getShopCoordinates(shop, 0);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([sLat, sLng], 16, { animate: true });
    }
    if (userLocation) {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, sLat, sLng);
      const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
      setDirectionDistanceText(text);
      drawDirectionRoute({ ...shop, lat: sLat, lng: sLng });
    }
  };

  // Get Safe Google Maps Turn-by-Turn GPS Navigation URL
  const getDirectionsUrl = (shop: Shop) => {
    const [sLat, sLng] = getShopCoordinates(shop, 0);
    const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';
    // &dir_action=navigate triggers instant turn-by-turn voice guidance on Google Maps mobile app
    return `https://www.google.com/maps/dir/?api=1&destination=${sLat},${sLng}${originParam}&dir_action=navigate`;
  };

  // Open Google Maps Directions
  const handleOpenGoogleMapsDirections = (shop: Shop) => {
    drawDirectionRoute(shop);
    const url = getDirectionsUrl(shop);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Due Collection Submit
  const handleDueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    const amount = parseFloat(dueAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('সঠিক টাকার অংক লিখুন');
      return;
    }
    onRecordDuePayment(selectedShop.id, amount, dueMethod);
    setIsDueModalOpen(false);
    setDueAmount('');
    // update locally selected shop due
    setSelectedShop((prev) => (prev ? { ...prev, previousDue: Math.max(0, prev.previousDue - amount) } : null));
  };

  return (
    <div className="space-y-3">
      {/* Top Header & Metrics Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-neutral-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Compass className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                ফিল্ড রুট ম্যাপ (Free Interactive Map)
              </h2>
              <p className="text-xs text-neutral-500">
                ওপেন-স্ট্রিট ম্যাপ দিয়ে দোকানের অবস্থান, বকেয়া ট্র্যাকিং ও দ্রুত নেভিগেশন
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Live GPS Locate button */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
          >
            <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'লোকেশন ট্র্যাকিং...' : 'আমার অবস্থান (GPS)'}</span>
          </button>

          {/* Quick Stats */}
          <div className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-100 px-2.5 py-1.5 rounded-xl border border-neutral-200">
            <span className="text-neutral-600">দোকান: {filteredShops.length}টি</span>
            <span className="text-neutral-300">|</span>
            <span className="text-rose-600">
              বকেয়া: ৳
              {filteredShops
                .reduce((sum, s) => sum + s.previousDue, 0)
                .toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {locationError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/90 shadow-xs flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ম্যাপে দোকান বা ফোন খুঁজুন..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Route Selector */}
        <select
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
          className="text-xs bg-neutral-100 border border-neutral-300 rounded-xl px-2.5 py-1.5 text-neutral-800 font-medium focus:outline-hidden"
        >
          <option value="all">সকল রুট ({shops.length})</option>
          {routes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Due filter chips */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setDueFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              dueFilter === 'ALL'
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            সব
          </button>
          <button
            onClick={() => setDueFilter('DUE')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              dueFilter === 'DUE'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            বকেয়া দোকান
          </button>
          <button
            onClick={() => setDueFilter('PAID')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              dueFilter === 'PAID'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            পরিশোধিত
          </button>
        </div>
      </div>

      {/* Main Map & Side List Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Map Canvas */}
        <div
          className={`transition-all duration-300 ${
            isFullScreenMap
              ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0'
              : `lg:col-span-8 xl:col-span-9 relative bg-neutral-200 rounded-3xl overflow-hidden border border-neutral-300 shadow-sm ${
                  isTurnByTurnActive ? 'h-[580px] sm:h-[660px]' : 'h-[460px] sm:h-[520px]'
                }`
          }`}
        >
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Map Layer Switcher & Legend */}
          <div
            className={`absolute z-10 flex flex-col items-end gap-1.5 pointer-events-auto transition-all duration-200 ${
              isTurnByTurnActive
                ? 'top-[96px] sm:top-3 right-2 sm:right-3'
                : 'top-3 right-3'
            }`}
          >
            {/* Satellite vs Street Map Mode */}
            <div className="bg-white/95 backdrop-blur-xs p-1 rounded-xl border border-neutral-200 shadow-md flex items-center gap-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setMapLayerType('streets')}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  mapLayerType === 'streets'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title="ফ্রি সাধারণ রোড ম্যাপ ভিউ"
              >
                <Layers className="w-3 h-3" />
                <span>রোড ম্যাপ</span>
              </button>
              <button
                type="button"
                onClick={() => setMapLayerType('satellite')}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  mapLayerType === 'satellite'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title="ফুড ডেলিভারি অ্যাপসের মতো স্পষ্ট স্যাটেলাইট ঘর-বাড়ি ও ছাদ ভিউ (ফ্রি)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>🛰️ স্যাটেলাইট (ঘর-বাড়ি)</span>
              </button>
            </div>

            {/* Map Legend */}
            <div className="bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-neutral-200 shadow-xs text-[11px] font-bold flex items-center gap-3">
              <span className="flex items-center gap-1 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                বকেয়া শপ
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                পরিশোধিত
              </span>
              {userLocation && (
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  আপনার অবস্থান
                </span>
              )}
            </div>
          </div>

          {/* TURN-BY-TURN LIVE GPS NAVIGATION DRIVER HUD (TOP) */}
          {selectedShop && userLocation && isTurnByTurnActive && (
            <div className="absolute top-2 left-2 right-2 sm:left-3 sm:right-auto sm:max-w-md z-20 animate-in fade-in slide-in-from-top duration-200">
              <div className="bg-neutral-900/98 backdrop-blur-md text-white p-3 rounded-2xl border-2 border-emerald-500 shadow-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2.5">
                  {/* Giant Maneuver Arrow Box */}
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                    {renderManeuverIcon(
                      turnSteps[currentStepIndex]?.modifier || 'straight',
                      'w-7 h-7 text-white'
                    )}
                  </div>

                  {/* Turn Instruction Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg sm:text-xl font-black text-white font-mono leading-none">
                        {turnSteps[currentStepIndex]
                          ? `${turnSteps[currentStepIndex].distanceMeters} মি.`
                          : liveDistanceMeters !== null
                          ? `${liveDistanceMeters} মি.`
                          : 'সামনে'}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400">পর</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {turnSteps[currentStepIndex]?.instruction || 'দোকানের অভিমুখে সোজা চলুন'}
                    </div>
                    {turnSteps[currentStepIndex + 1] && (
                      <div className="text-[10px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <span className="text-neutral-500">পরবর্তী:</span>
                        <span>{turnSteps[currentStepIndex + 1].instruction}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Voice & Steps list & Auto-follow & Fullscreen & Close */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newMute = !isVoiceMuted;
                        setIsVoiceMuted(newMute);
                        if (!newMute && turnSteps[currentStepIndex]) {
                          speakInstruction(turnSteps[currentStepIndex].instruction, false);
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isVoiceMuted
                          ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                          : 'bg-emerald-700/80 border-emerald-500 text-white'
                      }`}
                      title={isVoiceMuted ? 'ভয়েস গাইডেন্স চালু করুন' : 'ভয়েস গাইডেন্স বন্ধ করুন'}
                    >
                      {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowStepsModal(true)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs cursor-pointer"
                      title="রুটের সকল বাঁক ও মোড়ের তালিকা"
                    >
                      <List className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoFollow(true);
                        if (mapInstanceRef.current && userLocation) {
                          mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 17, { animate: true });
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        autoFollow
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                      }`}
                      title="ক্যামেরা কেন্দ্রে লক রাখুন"
                    >
                      <Target className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFullScreenMap((prev) => !prev)}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isFullScreenMap
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                      title={isFullScreenMap ? 'ফুল-স্ক্রিন মোড বন্ধ করুন' : 'ফুল-স্ক্রিন ড্রাইভার মোড চালু করুন'}
                    >
                      {isFullScreenMap ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCloseSelectedShop()}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-900 border border-neutral-700 text-neutral-300 hover:text-white text-xs cursor-pointer"
                      title="টার্ন-বাই-টার্ন নেভিগেশন বন্ধ করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-bar: Target Shop and Speed */}
                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-neutral-800 text-neutral-300">
                  <span className="truncate">
                    গন্তব্য: <strong className="text-emerald-400">{selectedShop.name}</strong>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {liveSpeedKmh > 0 && (
                      <span className="font-mono text-blue-300 font-bold">{liveSpeedKmh} কিমি/ঘ</span>
                    )}
                    <span className="text-[9px] text-emerald-400 font-mono">লাইভ জিপিএস</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standard Compass Top Banner if Turn-by-Turn is NOT active */}
          {selectedShop && userLocation && !isTurnByTurnActive && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 max-w-[270px] sm:max-w-xs animate-in fade-in slide-in-from-top duration-200">
              <div className="bg-neutral-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl border border-neutral-700/80 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 transition-transform duration-500"
                      style={{
                        transform: `rotate(${liveHeadingDeg || 0}deg)`,
                      }}
                      title="দোকানের দিকে কম্পাস অভিমুখ"
                    >
                      <NavIcon className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-white flex items-center gap-1 leading-tight">
                        <span>
                          {liveDistanceMeters !== null && liveDistanceMeters <= 35
                            ? 'দোকানের সামনে আছেন'
                            : liveHeadingDeg !== null
                            ? getCompassDirectionName(liveHeadingDeg)
                            : 'অগ্রসর হোন'}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold font-mono">
                        {liveDistanceMeters !== null
                          ? liveDistanceMeters < 1000
                            ? `${liveDistanceMeters} মিটার বাকি`
                            : `${(liveDistanceMeters / 1000).toFixed(2)} কিমি বাকি`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAutoFollow(true);
                      if (mapInstanceRef.current && userLocation) {
                        mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
                      }
                    }}
                    className={`px-2 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                      autoFollow
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-600'
                    }`}
                    title={autoFollow ? 'অটো-ফলো মোড চালু: চলার সাথে সাথে ক্যামেরা সেন্টারে থাকবে' : 'ক্যামেরা কেন্দ্রে লক করতে ক্লিক করুন'}
                  >
                    <Target className={`w-3 h-3 ${autoFollow ? 'text-white' : 'text-neutral-400'}`} />
                    <span>{autoFollow ? 'অটো-লক' : 'লক করুন'}</span>
                  </button>
                </div>

                <div className="text-[10px] text-neutral-300 mt-1 pt-1 border-t border-neutral-800 flex items-center justify-between">
                  <span className="truncate">গন্তব্য: <b className="text-white">{selectedShop.name}</b></span>
                  <span className="text-[9px] text-emerald-400 font-mono shrink-0">২ সে. লাইভ</span>
                </div>
              </div>
            </div>
          )}

          {/* 1. COMPACT GOOGLE MAPS NAVIGATION DOCK (BOTTOM) when turn-by-turn is active & minimized */}
          {selectedShop && isTurnByTurnActive && isBottomCardMinimized && (
            <div className="absolute bottom-2.5 left-2 right-2 sm:left-4 sm:right-4 z-20 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom duration-200">
              <div className="bg-neutral-900/95 backdrop-blur-md text-white rounded-2xl p-2.5 sm:p-3 border border-emerald-500/80 shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Live ETA & Remaining Distance */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/60 flex items-center justify-center shrink-0">
                      <NavIcon className="w-5 h-5 text-emerald-400 fill-emerald-400 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-emerald-400 font-mono leading-none">
                          {liveDistanceMeters !== null
                            ? liveDistanceMeters < 1000
                              ? `${liveDistanceMeters} মি.`
                              : `${(liveDistanceMeters / 1000).toFixed(2)} কিমি`
                            : directionDistanceText || 'নির্ণয় হচ্ছে...'}
                        </span>
                        <span className="text-xs text-neutral-300 font-bold">
                          ~ {liveDistanceMeters !== null ? Math.max(1, Math.ceil((liveDistanceMeters / 1000 / 22) * 60)) : 1} মি.
                        </span>
                        {liveSpeedKmh > 0 && (
                          <span className="text-[10px] text-blue-300 font-mono font-bold hidden xs:inline">
                            • {liveSpeedKmh} কিমি/ঘ
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-200 font-bold truncate flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                        <span className="truncate">{selectedShop.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectShopForOrder(selectedShop.id)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                      title="অর্ডার কাটুন"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">অর্ডার</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDueModalOpen(true)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                      title="বকেয়া আদায়"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">বকেয়া</span>
                    </button>

                    {/* Expand details button */}
                    <button
                      type="button"
                      onClick={() => setIsBottomCardMinimized(false)}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl border border-neutral-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="দোকানের বিস্তারিত তথ্য দেখুন"
                    >
                      <ChevronUp className="w-4 h-4 text-emerald-400" />
                    </button>

                    {/* Exit Navigation button */}
                    <button
                      type="button"
                      onClick={handleCloseSelectedShop}
                      className="p-1.5 bg-neutral-800 hover:bg-rose-900 border border-neutral-700 text-neutral-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
                      title="নেভিগেশন সমাপ্ত করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. FULL SHOP ACTION CARD when NOT minimized (or when navigation hasn't started yet) */}
          {selectedShop && (!isTurnByTurnActive || !isBottomCardMinimized) && (
            <div className="absolute bottom-2.5 left-2 right-2 sm:left-4 sm:right-4 z-20 bg-white/98 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-neutral-200 shadow-2xl max-w-xl mx-auto animate-in fade-in slide-in-from-bottom duration-200 max-h-[75vh] overflow-y-auto">
              {/* Live 2-Second Navigation Tracker Banner */}
              <div className="mb-2.5 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      {isLiveTracking && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${isLiveTracking ? 'bg-emerald-600' : 'bg-neutral-400'}`}></span>
                    </span>
                    <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                      {isLiveTracking ? 'লাইভ ডিরেকশন সক্রিয় (প্রতি ২ সেকেন্ডে আপডেট হচ্ছে)' : 'লাইভ ট্র্যাকিং স্থগিত'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLiveTracking((prev) => !prev)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold border bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300 flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                    title={isLiveTracking ? '২ সেকেন্ড পর পর লাইভ ট্র্যাকিং বন্ধ করুন' : '২ সেকেন্ড পর পর লাইভ ট্র্যাকিং চালু করুন'}
                  >
                    {isLiveTracking ? (
                      <>
                        <Pause className="w-3 h-3 text-neutral-600" />
                        <span>পজ</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-emerald-600" />
                        <span>২ সে. ট্র্যাকিং চালু</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Distance & Real-Time Direction Details */}
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                  <div className="bg-white/90 p-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                    <span className="text-[9px] text-neutral-500 font-bold block">দোকানের দূরত্ব</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-700">
                      {liveDistanceMeters !== null
                        ? liveDistanceMeters < 1000
                          ? `${liveDistanceMeters} মিটার`
                          : `${(liveDistanceMeters / 1000).toFixed(2)} কিমি`
                        : directionDistanceText || 'নির্ণয় হচ্ছে...'}
                    </span>
                  </div>

                  <div className="bg-white/90 p-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                    <span className="text-[9px] text-neutral-500 font-bold block flex items-center justify-center gap-0.5">
                      <Bike className="w-2.5 h-2.5 text-blue-600" />
                      বাইকে আনুমানিক
                    </span>
                    <span className="text-xs font-black text-blue-700">
                      ~ {liveDistanceMeters !== null ? Math.max(1, Math.ceil((liveDistanceMeters / 1000 / 22) * 60)) : 1} মিনিট
                    </span>
                  </div>

                  <div className="bg-white/90 p-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                    <span className="text-[9px] text-neutral-500 font-bold block flex items-center justify-center gap-0.5">
                      <Footprints className="w-2.5 h-2.5 text-amber-600" />
                      হেঁটে আনুমানিক
                    </span>
                    <span className="text-xs font-black text-amber-700">
                      ~ {liveDistanceMeters !== null ? Math.max(1, Math.ceil((liveDistanceMeters / 1000 / 4.5) * 60)) : 3} মিনিট
                    </span>
                  </div>

                  <div className="bg-white/90 p-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                    <span className="text-[9px] text-neutral-500 font-bold block flex items-center justify-center gap-0.5">
                      <Compass className="w-2.5 h-2.5 text-purple-600" />
                      অভিমুখ (দিক)
                    </span>
                    <span className="text-[11px] font-black text-purple-800 truncate block">
                      {liveHeadingDeg !== null ? getCompassDirectionName(liveHeadingDeg) : 'সোজা'}
                    </span>
                  </div>
                </div>

                {liveDistanceMeters !== null && liveDistanceMeters <= 35 && (
                  <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>🎉 আপনি দোকানে পৌঁছেছেন! বকেয়া আদায় বা অর্ডার সংগ্রহ করুন।</span>
                  </div>
                )}
              </div>

              {/* Shop Header & Info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                      {selectedShop.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedShop.previousDue > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {selectedShop.previousDue > 0
                        ? `বকেয়া: ৳${selectedShop.previousDue.toLocaleString()}`
                        : 'পরিশোধিত'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    মালিক: {selectedShop.ownerName} | {selectedShop.routeArea}
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                    {selectedShop.address}
                  </p>
                </div>

                {/* Card Header Actions: Minimize to see map vs Close */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isTurnByTurnActive && (
                    <button
                      type="button"
                      onClick={() => setIsBottomCardMinimized(true)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      title="ম্যাপ দেখার জন্য কার্ড লুকান (ডিরেকশন চালু থাকবে)"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      <span>ম্যাপ দেখুন</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isTurnByTurnActive) {
                        // Crucial fix: Clicking cross while navigating minimizes card so direction stays on the map!
                        setIsBottomCardMinimized(true);
                      } else {
                        handleCloseSelectedShop();
                      }
                    }}
                    className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                    title={isTurnByTurnActive ? 'ম্যাপ বড় করে দেখুন (মিনিমাইজ)' : 'বন্ধ করুন'}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-neutral-100">
                {/* 0. Primary Turn-by-Turn Live Navigation Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isTurnByTurnActive) {
                      setIsBottomCardMinimized(true); // Minimize card to immediately reveal map & direction!
                    } else {
                      drawDirectionRoute(selectedShop, true);
                      setIsBottomCardMinimized(true); // Auto-minimize upon starting navigation!
                    }
                  }}
                  className={`col-span-2 sm:col-span-4 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 ${
                    isTurnByTurnActive
                      ? 'bg-neutral-900 text-emerald-400 border border-emerald-500'
                      : 'bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-900/20'
                  }`}
                >
                  <NavIcon className={`w-4 h-4 ${isTurnByTurnActive ? 'text-emerald-400 animate-spin' : 'text-white'}`} />
                  <span>
                    {isTurnByTurnActive
                      ? '🗺️ ম্যাপ স্ক্রিনে টার্ন-বাই-টার্ন নেভিগেশন দেখুন (মিনিমাইজ)'
                      : '🧭 টার্ন-বাই-টার্ন লাইভ জিপিএস নেভিগেশন শুরু করুন'}
                  </span>
                  {turnSteps.length > 0 && !isTurnByTurnActive && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
                      {turnSteps.length}টি মোড়
                    </span>
                  )}
                </button>

                {/* Explicit End Navigation Button when turn-by-turn is active */}
                {isTurnByTurnActive && (
                  <button
                    type="button"
                    onClick={handleCloseSelectedShop}
                    className="col-span-2 sm:col-span-4 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                    title="টার্ন-বাই-টার্ন নেভিগেশন পুরোপুরি শেষ করুন"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    <span>🛑 টার্ন-বাই-টার্ন নেভিগেশন সমাপ্ত করুন</span>
                  </button>
                )}

                {/* 1. Book Order */}
                <button
                  onClick={() => onSelectShopForOrder(selectedShop.id)}
                  className="flex items-center justify-center gap-1 py-2 px-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-[11px] shadow-xs transition-colors cursor-pointer active:scale-95"
                >
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span>অর্ডার</span>
                </button>

                {/* 2. Collect Due */}
                <button
                  onClick={() => setIsDueModalOpen(true)}
                  className="flex items-center justify-center gap-1 py-2 px-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-[11px] shadow-xs transition-colors cursor-pointer active:scale-95"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>বকেয়া আদায়</span>
                </button>

                {/* 3. Google Maps Directions */}
                <a
                  href={getDirectionsUrl(selectedShop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => drawDirectionRoute(selectedShop)}
                  className="flex items-center justify-center gap-1 py-2 px-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-[11px] shadow-xs transition-colors cursor-pointer active:scale-95"
                  title="গুগল ম্যাপে লাইভ টার্ন-বাই-টার্ন নেভিগেশন খুলুন"
                >
                  <NavIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>গুগল নেভিগেশন</span>
                </a>

                {/* 4. Update Current GPS Location */}
                {onUpdateShopCoordinates && (
                  <button
                    onClick={() => handleUpdateShopGPS(selectedShop.id)}
                    disabled={isUpdatingGPS}
                    className="flex items-center justify-center gap-1 py-2 px-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[11px] shadow-xs transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
                    title="দোকানের সামনে দাঁড়িয়ে লাইভ জিপিএস লোকেশন আপডেট করুন"
                  >
                    <LocateFixed className={`w-3.5 h-3.5 text-blue-200 shrink-0 ${isUpdatingGPS ? 'animate-spin' : ''}`} />
                    <span>{isUpdatingGPS ? 'সেট হচ্ছে...' : 'জিপিএস পিন'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Route Shops List & Nearest Shops */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-2.5">
          <div className="bg-white rounded-2xl p-3 border border-neutral-200/90 shadow-xs">
            <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{userLocation ? 'নিকটবর্তী দোকানসমূহ (দূরত্ব অনুযায়ী)' : 'রুটের দোকান তালিকা'}</span>
              <span className="text-neutral-400 font-normal">({filteredShops.length})</span>
            </h4>

            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {(userLocation ? nearestShops : filteredShops).map((shop) => {
                const isSelected = selectedShop?.id === shop.id;
                const distanceText =
                  'distanceKm' in shop
                    ? (shop as any).distanceKm < 1
                      ? `${Math.round((shop as any).distanceKm * 1000)} মি.`
                      : `${(shop as any).distanceKm.toFixed(1)} কি.মি.`
                    : null;

                return (
                  <div
                    key={shop.id}
                    onClick={() => handleFocusShop(shop)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-neutral-900 truncate">
                          {shop.name}
                        </h5>
                        <p className="text-[11px] text-neutral-500 truncate">{shop.routeArea}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            shop.previousDue > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {shop.previousDue > 0 ? `৳${shop.previousDue}` : 'পরিশোধিত'}
                        </span>
                        {distanceText && (
                          <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                            {distanceText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                      <a
                        href={`tel:${shop.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-neutral-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-neutral-400" />
                        <span>{shop.phone}</span>
                      </a>

                      <div className="flex items-center gap-2">
                        <a
                          href={getDirectionsUrl(shop)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            drawDirectionRoute(shop);
                          }}
                          className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                          title="গুগল ম্যাপে দিকনির্দেশনা দেখুন"
                        >
                          <NavIcon className="w-2.5 h-2.5" />
                          <span>ডিরেকশন</span>
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectShopForOrder(shop.id);
                          }}
                          className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5"
                        >
                          <span>অর্ডার</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Due Collection Quick Modal */}
      {isDueModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              বকেয়া টাকা আদায়
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              দোকান: <span className="font-bold text-neutral-800">{selectedShop.name}</span>
            </p>
            <p className="text-xs text-rose-600 font-bold mt-0.5">
              বর্তমান মোট বকেয়া: ৳{selectedShop.previousDue.toLocaleString()}
            </p>

            <form onSubmit={handleDueSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  আদায়কৃত টাকার পরিমাণ (৳)
                </label>
                <input
                  type="number"
                  required
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value)}
                  placeholder="যেমন: ২০০০"
                  className="w-full text-base font-black px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  পেমেন্ট মেথড
                </label>
                <select
                  value={dueMethod}
                  onChange={(e) => setDueMethod(e.target.value as PaymentMethod)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-neutral-300 rounded-xl bg-neutral-50"
                >
                  <option value="CASH">নগদ ক্যাশ (CASH)</option>
                  <option value="BKASH">বিকাশ (bKash)</option>
                  <option value="NAGAD">নগদ (Nagad)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDueModalOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 shadow"
                >
                  নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Turn-by-Turn Route Steps List Modal */}
      {showStepsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <List className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">টার্ন-বাই-টার্ন রুট নির্দেশিকা</h3>
                  <p className="text-[11px] text-neutral-400">
                    গন্তব্য: {selectedShop?.name || 'দোকান'} ({turnSteps.length}টি মোড়)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStepsModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-neutral-100">
              {turnSteps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                return (
                  <div
                    key={step.id}
                    className={`pt-2 first:pt-0 p-2 rounded-2xl flex items-center gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-emerald-50/90 border border-emerald-400 shadow-2xs'
                        : isPassed
                        ? 'opacity-50'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isPassed
                          ? 'bg-neutral-200 text-neutral-500'
                          : 'bg-neutral-800 text-neutral-200'
                      }`}
                    >
                      {renderManeuverIcon(step.modifier, 'w-5 h-5')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold text-neutral-900 leading-snug">
                        {step.instruction}
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-emerald-700">
                          {step.distanceMeters > 0 ? `${step.distanceMeters} মিটার` : 'গন্তব্য'}
                        </span>
                        <span>•</span>
                        <span className="truncate">{step.roadName}</span>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0 shadow-2xs">
                        বর্তমান
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const newMute = !isVoiceMuted;
                  setIsVoiceMuted(newMute);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-300 bg-white cursor-pointer"
              >
                {isVoiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
                <span>{isVoiceMuted ? 'ভয়েস বন্ধ' : 'ভয়েস চালু'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowStepsModal(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
