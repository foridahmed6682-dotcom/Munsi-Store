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
  Eye
} from 'lucide-react';
import { Shop, PaymentMethod, Route } from '../types';

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

      // Standard OpenStreetMap Free Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // When user manually drags the map, pause auto-follow camera
      map.on('dragstart', () => {
        setAutoFollow(false);
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

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([
          [latitude, longitude],
          [sLat, sLng],
        ]);
      } else if (map) {
        const polyline = L.polyline(
          [
            [latitude, longitude],
            [sLat, sLng],
          ],
          {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
            dashArray: '8, 8',
          }
        );
        polyline.addTo(map);
        routePolylineRef.current = polyline;
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
        const [fLat, fLng] = getShopCoordinates(found, 0);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([fLat, fLng], 16, { animate: true });
        }
        if (userLocation) {
          const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, fLat, fLng);
          const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
          setDirectionDistanceText(text);
          drawDirectionRoute({ ...found, lat: fLat, lng: fLng });
        }
      }
    }
  }, [targetShopId, shops, userLocation]);

  // Draw visual navigation polyline on map and start 2-second live updates
  const drawDirectionRoute = (shop: Shop) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsLiveTracking(true); // Automatically ensure 2-second live GPS tracking is active
    setAutoFollow(true); // Automatically lock camera to user's movement for live turn-by-turn tracking

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

    const startPoint: L.LatLngTuple = [userLocation.lat, userLocation.lng];
    const endPoint: L.LatLngTuple = [sLat, sLng];

    const polyline = L.polyline([startPoint, endPoint], {
      color: '#2563eb',
      weight: 5,
      opacity: 0.9,
      dashArray: '8, 8',
    });

    polyline.addTo(map);
    routePolylineRef.current = polyline;

    map.fitBounds([startPoint, endPoint], { padding: [60, 60], maxZoom: 16 });

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
    if (onClearTargetShop) onClearTargetShop();
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  };

  // Focus a specific shop on the map
  const handleFocusShop = (shop: Shop) => {
    setSelectedShop(shop);
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
        <div className="lg:col-span-8 xl:col-span-9 relative bg-neutral-200 rounded-3xl overflow-hidden border border-neutral-300 shadow-sm h-[460px] sm:h-[520px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Map legend */}
          <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-neutral-200 shadow-sm text-[11px] font-bold flex items-center gap-3">
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

          {/* Live Turn Direction & Auto-Follow Heads-Up Display */}
          {selectedShop && userLocation && (
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

          {/* Selected Shop Action Card & 2-Second Live Navigation HUD */}
          {selectedShop && (
            <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/98 backdrop-blur-md rounded-2xl p-3.5 border border-neutral-200 shadow-xl max-w-xl mx-auto animate-in fade-in slide-in-from-bottom duration-200">
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

                <button
                  onClick={handleCloseSelectedShop}
                  className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center text-xs font-bold cursor-pointer"
                  title="বন্ধ করুন"
                >
                  ✕
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-neutral-100">
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
    </div>
  );
};
