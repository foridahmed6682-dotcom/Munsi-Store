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
  AlertCircle
} from 'lucide-react';
import { Shop, Route } from '../types';

interface AddShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveShop: (shop: Shop) => void;
  existingShops?: Shop[];
  routes?: Route[];
  initialRoute?: string;
}

export const AddShopModal: React.FC<AddShopModalProps> = ({
  isOpen,
  onClose,
  onSaveShop,
  existingShops = [],
  routes = [],
  initialRoute = '',
}) => {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [routeArea, setRouteArea] = useState(initialRoute || '');
  const [address, setAddress] = useState('');
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
      setName('');
      setOwnerName('');
      setPhone('');
      const defaultRoute = initialRoute || (routes && routes.length > 0 ? routes[0].banglaName : 'চকবাজার রুট');
      setRouteArea(defaultRoute);
      setAddress('');
      setLat(undefined);
      setLng(undefined);
      setLocationSuccessText(null);
      setLocationError(null);
      setShowMapPicker(false);
    }
  }, [isOpen]);

  // Clean up map on unmount or close
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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

        // On map click, move marker
        map.on('click', (e: L.LeafletMouseEvent) => {
          const clickLat = Number(e.latlng.lat.toFixed(6));
          const clickLng = Number(e.latlng.lng.toFixed(6));
          initialMarker.setLatLng([clickLat, clickLng]);
          setLat(clickLat);
          setLng(clickLng);
          setLocationSuccessText(`ম্যাপে লোকেশন পয়েন্টার নির্ধারিত হয়েছে (${clickLat}, ${clickLng})`);
          setLocationError(null);
        });

        // On marker drag
        initialMarker.on('dragend', () => {
          const pos = initialMarker.getLatLng();
          const dragLat = Number(pos.lat.toFixed(6));
          const dragLng = Number(pos.lng.toFixed(6));
          setLat(dragLat);
          setLng(dragLng);
          setLocationSuccessText(`ম্যাপে লোকেশন পয়েন্টার নির্ধারিত হয়েছে (${dragLat}, ${dragLng})`);
          setLocationError(null);
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

    const cleanRoute = routeArea.trim() || 'সাধারণ রুট';

    const newShop: Shop = {
      id: `shop-${Date.now()}`,
      name: name.trim(),
      ownerName: ownerName.trim() || 'মালিক',
      phone: phone.trim(),
      routeArea: cleanRoute,
      address: address.trim() || 'বাজার সংলগ্ন',
      previousDue: 0,
      category: category,
      lastVisitDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      lat: lat,
      lng: lng,
    };

    onSaveShop(newShop);
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
                নতুন দোকান ও লোকেশন যুক্ত করুন
              </h3>
              <p className="text-[11px] text-neutral-500">
                দোকানের তথ্য, রুট নাম ও ম্যাপস লোকেশন সংরক্ষণ করুন
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

          {/* Route Name (User requested: "রুট এর নাম লেখা যাবে") */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-neutral-800 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-emerald-700" />
                <span>রুট এর নাম লিখুন বা নির্বাচন করুন</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-neutral-500">যেকোনো নতুন নাম টাইপ করা যাবে</span>
            </div>
            <input
              type="text"
              required
              list="routes-datalist"
              value={routeArea}
              onChange={(e) => setRouteArea(e.target.value)}
              placeholder="যেমন: চকবাজার রুট, মিরপুর-১০, বা নতুন কোনো রুটের নাম"
              className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-bold text-neutral-900 bg-white"
            />
            <datalist id="routes-datalist">
              {availableRouteNames.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>

            {/* Quick Route Suggestion Chips */}
            {availableRouteNames.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-neutral-400 mr-1">বিদ্যমান রুট:</span>
                {availableRouteNames.slice(0, 8).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRouteArea(r)}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium transition-colors ${
                      routeArea === r
                        ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="font-bold text-neutral-800 block mb-1">
              দোকানের ঠিকানা / ল্যান্ডমার্ক
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="রোড নং ৪, বাজার চত্বর, ঢাকা"
              className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-neutral-900"
            />
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
