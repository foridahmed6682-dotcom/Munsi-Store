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
  LocateFixed
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
      // Default to Dhaka center: [23.75, 90.39]
      const map = L.map(mapContainerRef.current, {
        center: [23.75, 90.39],
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

    filteredShops.forEach((shop) => {
      // Fallback coordinates if not set
      const lat = shop.lat ?? 23.75;
      const lng = shop.lng ?? 90.39;

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

    // Auto-fit bounds if we have shop locations
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredShops]);

  // Locate User
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('আপনার ব্রাউজারে জিপিএস লোকেশন সাপোর্ট নেই');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        const map = mapInstanceRef.current;
        if (map) {
          map.setView([latitude, longitude], 15);

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
            marker.bindPopup('<b>আপনার বর্তমান অবস্থান</b>').openPopup();
            userMarkerRef.current = marker;
          }
        }
      },
      (err) => {
        setIsLocating(false);
        setLocationError('লোকেশন পাওয়া যায়নি। অনুগ্রহ করে ডিভাইসের GPS অন করুন।');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // High Accuracy Shop GPS Position Updater
  const handleUpdateShopGPS = (shopId: string) => {
    if (!navigator.geolocation) {
      alert('আপনার ডিভাইসে জিপিএস সাপোর্ট নেই');
      return;
    }

    setIsUpdatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsUpdatingGPS(false);
        const { latitude, longitude, accuracy } = pos.coords;
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
      },
      (err) => {
        setIsUpdatingGPS(false);
        let msg = 'জিপিএস লোকেশন রিড করা যায়নি।';
        if (err.code === 1) {
          msg = 'লোকেশন পারমিশন ডিনাই করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংসে জিপিএস অনুমতি দিন।';
        } else if (err.code === 2) {
          msg = 'ফোনের জিপিএস সিগন্যাল পাওয়া যাচ্ছে না।';
        } else if (err.code === 3) {
          msg = 'জিপিএস রিকোয়েস্ট টাইমআউট হয়েছে। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।';
        }
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Automatically focus shop if targetShopId is provided
  useEffect(() => {
    if (targetShopId) {
      const found = shops.find((s) => s.id === targetShopId);
      if (found) {
        setSelectedShop(found);
        if (mapInstanceRef.current && found.lat && found.lng) {
          mapInstanceRef.current.setView([found.lat, found.lng], 16, { animate: true });
        }
        if (userLocation && found.lat && found.lng) {
          const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, found.lat, found.lng);
          const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
          setDirectionDistanceText(text);
          drawDirectionRoute(found);
        }
      }
    }
  }, [targetShopId, shops, userLocation]);

  // Draw visual navigation polyline on map
  const drawDirectionRoute = (shop: Shop) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous polyline
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!userLocation) {
      handleLocateMe();
      return;
    }

    if (shop.lat !== undefined && shop.lng !== undefined) {
      const startPoint: L.LatLngTuple = [userLocation.lat, userLocation.lng];
      const endPoint: L.LatLngTuple = [shop.lat, shop.lng];

      const polyline = L.polyline([startPoint, endPoint], {
        color: '#2563eb',
        weight: 5,
        opacity: 0.9,
        dashArray: '8, 8',
      });

      polyline.addTo(map);
      routePolylineRef.current = polyline;

      map.fitBounds([startPoint, endPoint], { padding: [60, 60], maxZoom: 16 });

      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, shop.lat, shop.lng);
      const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
      setDirectionDistanceText(text);
    }
  };

  // Close selected shop drawer and clear polyline
  const handleCloseSelectedShop = () => {
    setSelectedShop(null);
    setDirectionDistanceText(null);
    if (onClearTargetShop) onClearTargetShop();
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  };

  // Focus a specific shop on the map
  const handleFocusShop = (shop: Shop) => {
    setSelectedShop(shop);
    if (mapInstanceRef.current && shop.lat && shop.lng) {
      mapInstanceRef.current.setView([shop.lat, shop.lng], 16, { animate: true });
    }
    if (userLocation && shop.lat && shop.lng) {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, shop.lat, shop.lng);
      const text = dist < 1 ? `${Math.round(dist * 1000)} মিটার` : `${dist.toFixed(2)} কিমি`;
      setDirectionDistanceText(text);
      drawDirectionRoute(shop);
    }
  };

  // Get Safe Google Maps Directions URL
  const getDirectionsUrl = (shop: Shop) => {
    if (shop.lat !== undefined && shop.lng !== undefined) {
      const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';
      return `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}${originParam}`;
    }
    const query = encodeURIComponent(`${shop.name} ${shop.address || shop.routeArea || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
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

          {/* Selected Shop Action Card Overlay */}
          {selectedShop && (
            <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/98 backdrop-blur-md rounded-2xl p-3.5 border border-neutral-200 shadow-xl max-w-lg mx-auto animate-in fade-in slide-in-from-bottom duration-200">
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
                    {directionDistanceText && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-0.5">
                        <NavIcon className="w-2.5 h-2.5" />
                        <span>দূরত্ব: {directionDistanceText}</span>
                      </span>
                    )}
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
                  title="গুগল ম্যাপে দিকনির্দেশনা ও লাইভ নেভিগেশন খুলুন"
                >
                  <NavIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>ডিরেকশন</span>
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
                    <span>{isUpdatingGPS ? 'সেট হচ্ছে...' : 'জিপিএস সেট'}</span>
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
