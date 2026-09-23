import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Store,
  MapPin,
  LocateFixed,
  Navigation as NavIcon,
  X,
  CheckCircle2,
  ExternalLink,
  Plus,
  Compass,
  AlertCircle,
  Loader2,
  RotateCw,
  Sparkles
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

// Helper to format reverse geocoded address nicely for Bangladesh context
function formatReverseGeocode(data: any): string {
  if (!data) return '';
  const addr = data.address;
  if (!addr) {
    if (data.display_name) {
      return data.display_name.split(', ').slice(0, 4).join(', ');
    }
    return '';
  }

  const parts: string[] = [];

  // 1. Point of interest / shop / landmark / building / market
  const landmark = addr.shop || addr.amenity || addr.building || addr.retail || addr.commercial || addr.office;
  if (landmark && typeof landmark === 'string' && !parts.includes(landmark)) {
    parts.push(landmark);
  }

  // 2. Road / Street / Lane
  const road = addr.road || addr.street || addr.footway || addr.path;
  if (road && typeof road === 'string' && !parts.includes(road)) {
    parts.push(road);
  }

  // 3. Mohalla / Neighbourhood / Quarter / Village / Residential
  const area = addr.neighbourhood || addr.quarter || addr.suburb || addr.residential || addr.village;
  if (area && typeof area === 'string' && !parts.includes(area)) {
    parts.push(area);
  }

  // 4. City District / Police Station / Thana / Ward / Sub-district
  const district = addr.city_district || addr.subdistrict || addr.borough || addr.ward;
  if (district && typeof district === 'string' && !parts.includes(district)) {
    parts.push(district);
  }

  // 5. City / Municipality / Town
  const city = addr.city || addr.town || addr.municipality || addr.county;
  if (city && typeof city === 'string' && !parts.includes(city)) {
    parts.push(city);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  if (data.display_name) {
    const rawParts = data.display_name.split(', ');
    const filtered = rawParts.filter(
      (p: string) => !['বাংলাদেশ', 'Bangladesh'].includes(p.trim()) && !/^\d{4,5}$/.test(p.trim())
    );
    return filtered.slice(0, 4).join(', ');
  }

  return '';
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
  const [category, setCategory] = useState('জেনারেল স্টোর / মুদি');

  // Location State
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccessText, setLocationSuccessText] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Map Leaflet references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Extract unique existing route names
  const availableRouteNames = React.useMemo(() => {
    const set = new Set<string>();
    // From dynamic routes list
    routes.forEach(r => set.add(r.banglaName));
    
    // Fallback from existing shops if needed
    existingShops.forEach((s) => {
      if (s.routeArea && s.routeArea.trim()) {
        set.add(s.routeArea.trim());
      }
    });

    // Default fallback popular routes if still empty
    if (set.size === 0) {
      set.add('চকবাজার রুট');
      set.add('মিরপুর রুট');
      set.add('গুলিস্তান ও সদরঘাট');
      set.add('ধানমন্ডি-মোহাম্মদপুর');
      set.add('উত্তরা সেক্টর রুট');
    }
    return Array.from(set);
  }, [existingShops, routes]);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
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
          setRouteArea(existingRoute || availableRouteNames[0] || 'চকবাজার রুট');
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
        const defaultRoute = initialRoute || (routes && routes.length > 0 ? routes[0].banglaName : (availableRouteNames[0] || 'চকবাজার রুট'));
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
    }
  }, [isOpen, editShop]);

  // Clean up map on unmount or close
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Reverse geocode latitude and longitude to human-readable address in Bengali
  const fetchAddressFromCoords = async (latitude: number, longitude: number, overwrite = true) => {
    setIsFetchingAddress(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=bn,en`,
        {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'bn,en',
          },
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const formatted = formatReverseGeocode(data);
        if (formatted) {
          if (overwrite || !address.trim()) {
            setAddress(formatted);
            setAddressAutoFilled(true);
            setLocationSuccessText(`ম্যাপ লোকেশন ও ঠিকানা অটোমেটিক সেট হয়েছে: ${formatted}`);
          }
        }
      }
    } catch (err) {
      console.log('Reverse geocoding error or timeout:', err);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  // Initialize or update Map when showMapPicker becomes true
  useEffect(() => {
    if (!showMapPicker || !isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const defaultLat = lat || 23.777176;
      const defaultLng = lng || 90.399452;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: lat && lng ? 17 : 14,
          zoomControl: true,
          fadeAnimation: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Create draggable custom pin
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
                margin-top: -50px;
                display: flex;
                flex-direction: column;
                align-items: center;
                pointer-events: none;
              ">
                <div style="
                  background: #059669;
                  color: white;
                  font-weight: 800;
                  font-size: 11px;
                  padding: 6px 12px;
                  border-radius: 12px;
                  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
                  border: 2.5px solid white;
                  white-space: nowrap;
                  display: flex;
                  align-items: center;
                  gap: 6px;
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
                  border-top: 10px solid #059669;
                  margin-top: -1px;
                "></div>
              </div>
            `,
          });

        const initialMarker = L.marker([defaultLat, defaultLng], {
          draggable: true,
          icon: createPinIcon(),
          zIndexOffset: 1000,
        }).addTo(map);

        markerRef.current = initialMarker;

        // Force invalidate size after a short delay to ensure correct rendering in the container
        setTimeout(() => {
          map.invalidateSize();
        }, 300);

        // On map click, move marker and auto-fill address
        map.on('click', (e: L.LeafletMouseEvent) => {
          const clickLat = Number(e.latlng.lat.toFixed(6));
          const clickLng = Number(e.latlng.lng.toFixed(6));
          initialMarker.setLatLng([clickLat, clickLng]);
          setLat(clickLat);
          setLng(clickLng);
          setLocationSuccessText(`ম্যাপে লোকেশন পয়েন্টার নির্ধারিত হয়েছে (${clickLat}, ${clickLng})`);
          setLocationError(null);
          // Auto-fetch address from clicked coordinates
          fetchAddressFromCoords(clickLat, clickLng, true);
        });

        // On marker drag, move marker and auto-fill address
        initialMarker.on('dragend', () => {
          const pos = initialMarker.getLatLng();
          const dragLat = Number(pos.lat.toFixed(6));
          const dragLng = Number(pos.lng.toFixed(6));
          setLat(dragLat);
          setLng(dragLng);
          setLocationSuccessText(`ম্যাপে লোকেশন পয়েন্টার নির্ধারিত হয়েছে (${dragLat}, ${dragLng})`);
          setLocationError(null);
          // Auto-fetch address from dragged coordinates
          fetchAddressFromCoords(dragLat, dragLng, true);
        });
      } else {
        mapInstanceRef.current.invalidateSize();
        if (lat && lng) {
          mapInstanceRef.current.setView([lat, lng], 17);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [showMapPicker, isOpen, lat, lng]);

  // GPS Auto-detection handler
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setLocationError('আপনার ব্রাউজারে জিপিএস লোকেশন সাপোর্ট করে না।');
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detectedLat = Number(pos.coords.latitude.toFixed(6));
        const detectedLng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setLat(detectedLat);
        setLng(detectedLng);
        setLocationSuccessText(`জিপিএস লোকেশন সংরক্ষিত হয়েছে (নির্ভুলতা: ±${accuracy} মি.)`);
        setIsLocating(false);

        // Auto-fetch address from detected GPS location
        fetchAddressFromCoords(detectedLat, detectedLng, true);

        // Update map if opened
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([detectedLat, detectedLng], 16);
          markerRef.current.setLatLng([detectedLat, detectedLng]);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'জিপিএস লোকেশন অ্যাক্সেস পাওয়া যায়নি।';
        if (err.code === 1) {
          msg = 'লোকেশন পারমিশন ডিনাই করা হয়েছে। ব্রাউজার সেটিংসে গিয়ে লোকেশন অনুমতি দিন।';
        } else if (err.code === 2) {
          msg = 'ডিভাইসের জিপিএস অবস্থান সনাক্ত করা যাচ্ছে না।';
        } else if (err.code === 3) {
          msg = 'লোকেশন রিকোয়েস্ট টাইমআউট হয়েছে।';
        }
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
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
    const cleanRoute = resolvedRoute;

    const savedShop: Shop = {
      ...(editShop ? editShop : {
        id: `shop-${Date.now()}`,
        previousDue: 0,
        createdAt: new Date().toISOString(),
      }),
      name: name.trim(),
      ownerName: ownerName.trim() || 'মালিক',
      phone: phone.trim(),
      routeArea: cleanRoute,
      address: address.trim() || 'বাজার সংলগ্ন',
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
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 leading-tight">
                {editShop ? 'দোকানের তথ্য এডিট ও আপডেট' : 'নতুন দোকান ও লোকেশন যুক্ত করুন'}
              </h3>
              <p className="text-[11px] text-neutral-500">
                {editShop ? 'দোকানের নাম, মোবাইল, রুট ও লোকেশন পরিবর্তন করুন' : 'দোকানের তথ্য, রুট নাম ও ম্যাপস লোকেশন সংরক্ষণ করুন'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Shop Name */}
          <div>
            <label className="font-bold text-neutral-800 block mb-1">
              দোকানের নাম <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: মেসার্স জনতা স্টোর বা নিউ ঢাকা জেনারেল"
              className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-neutral-900 bg-neutral-50/50"
            />
          </div>

          {/* Owner Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                মালিক / প্রোপ্রাইটরের নাম
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="যেমন: হাজী সাইফুল ইসলাম"
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-neutral-900"
              />
            </div>
            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="০১৭১xxxxxxx"
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-neutral-900"
              />
            </div>
          </div>

          {/* Route Selection (User requested: "নতুন দোকান সেট করার সময় রুট সিলেক্ট করার অপশন") */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-neutral-800 flex items-center gap-1.5 text-xs sm:text-sm">
                <Compass className="w-4 h-4 text-emerald-700" />
                <span>রুট নির্বাচন করুন (Select Route)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ড্রপডাউন থেকে বেছে নিন
              </span>
            </div>

            {/* Standard Dropdown Select */}
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
              className="w-full p-2.5 sm:p-3 border-2 border-emerald-600/40 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-bold text-neutral-900 bg-emerald-50/40 text-xs sm:text-sm shadow-xs cursor-pointer"
            >
              <option value="" disabled>-- রুট সিলেক্ট করুন --</option>
              {availableRouteNames.map((r) => (
                <option key={r} value={r}>
                  📍 {r}
                </option>
              ))}
              <option value="__CUSTOM__">➕ নতুন রুট লিখুন (কাস্টম রুট)...</option>
            </select>

            {/* If Custom Route is selected */}
            {isCustomRoute && (
              <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl animate-in fade-in">
                <label className="text-[11px] font-bold text-amber-900 block mb-1">
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
                  placeholder="যেমন: মতিঝিল রুট, মহাখালী, বা নতুন এলাকার নাম"
                  autoFocus
                  className="w-full p-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-neutral-900 bg-white text-xs"
                />
              </div>
            )}

            {/* Quick Route Suggestion Chips */}
            {availableRouteNames.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] text-neutral-500 font-semibold block mb-1">
                  অথবা সরাসরি বাটন চেপে সিলেক্ট করুন:
                </span>
                <div className="flex flex-wrap gap-1.5 items-center">
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
                        className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-emerald-600 hover:bg-emerald-50'
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
                    className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                      isCustomRoute
                        ? 'bg-amber-500 text-neutral-950 border-amber-600'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    + নতুন রুট
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Address with Automatic Map Location Reverse Geocode Autofill */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="font-bold text-neutral-800 flex items-center gap-1.5 text-xs sm:text-sm">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>দোকানের ঠিকানা / ল্যান্ডমার্ক</span>
              </label>

              {isFetchingAddress ? (
                <span className="text-[10px] text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  <span>ম্যাপ থেকে ঠিকানা লোড হচ্ছে...</span>
                </span>
              ) : addressAutoFilled ? (
                <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>ম্যাপ অনুযায়ী অটো-ইনপুট হয়েছে</span>
                </span>
              ) : (
                <span className="text-[10px] text-neutral-500 font-medium">
                  ম্যাপে ক্লিক করলে ঠিকানা অটো বসবে
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressAutoFilled(false);
                }}
                placeholder="ম্যাপে ক্লিক করলে বা জিপিএস অন করলে ঠিকানা নিজে থেকেই বসে যাবে..."
                className={`w-full p-2.5 sm:p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-neutral-900 pr-26 text-xs sm:text-sm transition-all ${
                  addressAutoFilled
                    ? 'bg-emerald-50/50 border-emerald-400 font-bold'
                    : 'border-neutral-300 bg-white'
                }`}
              />

              {lat && lng && (
                <button
                  type="button"
                  onClick={() => fetchAddressFromCoords(lat, lng, true)}
                  disabled={isFetchingAddress}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-neutral-100 hover:bg-emerald-100 active:bg-emerald-200 text-neutral-700 hover:text-emerald-800 rounded-lg text-[10px] font-bold border border-neutral-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="ম্যাপের পয়েন্টার অনুযায়ী ঠিকানা রিফ্রেশ করুন"
                >
                  <RotateCw className={`w-3 h-3 ${isFetchingAddress ? 'animate-spin text-emerald-700' : ''}`} />
                  <span>ম্যাপের ঠিকানা</span>
                </button>
              )}
            </div>

            {addressAutoFilled && (
              <p className="text-[10px] text-emerald-700 mt-1 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>ম্যাপ লোকেশন থেকে স্বয়ংক্রিয়ভাবে সংগৃহীত। প্রয়োজনে সম্পাদনা করতে পারেন।</span>
              </p>
            )}
          </div>

          {/* MAPS LOCATION INTEGRATION (User requested: "দোকানের নাম লেখার সময় লোকেশন সেভ করা যাবে ম্যাপসের মাধ্যমে") */}
          <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                <MapPin className="w-4 h-4 text-emerald-700" />
                ম্যাপসে দোকানের লোকেশন সেভ করুন
              </span>
              {lat && lng ? (
                <span className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3" /> লোকেশন সংরক্ষিত
                </span>
              ) : (
                <span className="text-[10px] text-neutral-500">ঐচ্ছিক কিন্তু সুপারিশকৃত</span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'জিপিএস খোঁজা হচ্ছে...' : '📍 বর্তমান জিপিএস লোকেশন নিন'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showMapPicker
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{showMapPicker ? 'ম্যাপ লুকান' : '🗺️ ম্যাপে পিন বসান'}</span>
              </button>
            </div>

            {/* Status Feedback */}
            {locationSuccessText && (
              <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 bg-emerald-100/80 p-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                <span>{locationSuccessText}</span>
              </p>
            )}

            {locationError && (
              <p className="text-[11px] text-rose-700 font-medium flex items-center gap-1 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{locationError}</span>
              </p>
            )}

            {/* Coordinates Display & Google Maps Link */}
            {lat && lng && (
              <div className="flex items-center justify-between text-[11px] bg-white p-2 rounded-xl border border-emerald-200">
                <div className="font-mono text-neutral-700">
                  <span>Lat: {lat}</span>, <span>Lng: {lng}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 text-[10px]"
                  >
                    <span>গুগল ম্যাপস</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLat(undefined);
                      setLng(undefined);
                      setLocationSuccessText(null);
                    }}
                    className="text-rose-600 hover:text-rose-800 text-[10px] font-medium"
                  >
                    মুছুন
                  </button>
                </div>
              </div>
            )}

            {/* Embedded Interactive Leaflet Map Picker */}
            {showMapPicker && (
              <div className="space-y-1 pt-1 animate-in fade-in">
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>ম্যাপে ক্লিক করে বা পিন টেনে সঠিক অবস্থান নির্ধারণ করুন:</span>
                </div>
                <div
                  ref={mapContainerRef}
                  className="w-full h-48 sm:h-56 rounded-xl border-2 border-emerald-600 shadow-inner overflow-hidden z-10"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-bold transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>দোকান ও লোকেশন সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
