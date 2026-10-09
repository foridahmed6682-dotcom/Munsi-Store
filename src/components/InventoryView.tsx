import React, { useState, useMemo, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  ArrowDownCircle,
  TrendingUp,
  RotateCcw,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  Trash2,
  Edit3,
  X,
  Upload,
  Printer,
  CheckSquare,
  Square,
  Building2,
  PieChart,
  FileSpreadsheet,
  Download,
  FileUp,
  Camera,
  Image as ImageIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Product, Category, Supplier } from '../types';
import { DEMO_PRODUCT_IDS, parseBanglaNumber, getSuppliers, addOrUpdateSupplier } from '../lib/storage';
import { processImageFile } from '../lib/imageUtils';
import { printProductsBatch } from '../lib/printService';
import {
  downloadInventoryCSV,
  downloadInventoryXLSX,
  downloadProductTemplateCSV,
  downloadProductTemplateXLSX,
  parseProductsFromCSV,
  parseSpreadsheetFile,
} from '../lib/backupService';
import { ProductImageLightboxModal } from './ProductImageLightboxModal';
import { SupplierSummaryModal } from './SupplierSummaryModal';

interface InventoryViewProps {
  products: Product[];
  categoriesList?: Category[];
  suppliersList?: Supplier[];
  onAddProduct: (product: Product) => void;
  onBatchAddProducts?: (products: Product[]) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onCleanAllMockData?: () => void;
  onAddSupplier?: (supplier: Supplier) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categoriesList,
  suppliersList,
  onAddProduct,
  onBatchAddProducts,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onCleanAllMockData,
  onAddSupplier,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [isSupplierSummaryOpen, setIsSupplierSummaryOpen] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Bulk CSV Import Modal State
  const [isBulkCsvModalOpen, setIsBulkCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewProducts, setCsvPreviewProducts] = useState<Product[]>([]);
  const [csvImportErrors, setCsvImportErrors] = useState<string[]>([]);
  const [csvSkippedCount, setCsvSkippedCount] = useState(0);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Bulk Image Upload & Matching in Preview Table
  const bulkPhotosInputRef = useRef<HTMLInputElement>(null);
  const singleRowPhotoInputRef = useRef<HTMLInputElement>(null);
  const activePhotoRowProdId = useRef<string | null>(null);
  const [isProcessingBulkPhotos, setIsProcessingBulkPhotos] = useState(false);
  const [bulkPhotoResult, setBulkPhotoResult] = useState<{ matched: number; total: number } | null>(null);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'with-img' | 'without-img'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPerPage, setPreviewPerPage] = useState(25);
  const [duplicateMode, setDuplicateMode] = useState<'update' | 'skip' | 'add_new'>('update');

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Stock In Modal
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInQty, setStockInQty] = useState('');

  // Add / Edit Product Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newBanglaName, setNewBanglaName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState('তেল ও ঘি');
  const [newSupplier, setNewSupplier] = useState('');
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [newUnit, setNewUnit] = useState('কার্টুন');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newMinAlert, setNewMinAlert] = useState('10');
  const [newTradeOffer, setNewTradeOffer] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    if (categoriesList && categoriesList.length > 0) {
      categoriesList.forEach((c) => set.add(c.banglaName || c.name));
    }
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products, categoriesList]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    if (suppliersList && suppliersList.length > 0) {
      suppliersList.forEach((s) => set.add(s.banglaName || s.name));
    }
    const defaultSups = getSuppliers();
    defaultSups.forEach((s) => set.add(s.banglaName || s.name));
    products.forEach((p) => {
      if (p.supplier && p.supplier.trim()) set.add(p.supplier.trim());
    });
    return Array.from(set);
  }, [products, suppliersList]);

  const handleSaveQuickSupplier = () => {
    const trimmed = quickSupplierName.trim();
    if (!trimmed) return;
    const newSup: Supplier = {
      id: `sup-${Date.now()}`,
      name: trimmed,
      banglaName: trimmed,
    };
    if (onAddSupplier) {
      onAddSupplier(newSup);
    } else {
      addOrUpdateSupplier(newSup);
    }
    setNewSupplier(trimmed);
    setQuickSupplierName('');
    setShowQuickAddSupplier(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchSup =
        supplierFilter === 'all' ||
        (supplierFilter === 'other'
          ? !p.supplier || p.supplier === 'অন্যান্য'
          : p.supplier === supplierFilter);
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.banglaName.toLowerCase().includes(search.toLowerCase()) ||
        (p.supplier && p.supplier.toLowerCase().includes(search.toLowerCase())) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchLowStock = onlyLowStock ? p.stock <= p.minStockAlert : true;
      return matchCat && matchSup && matchSearch && matchLowStock;
    });
  }, [products, categoryFilter, supplierFilter, search, onlyLowStock]);

  const metrics = useMemo(() => {
    const totalItems = products.length;
    const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + p.stock * p.unitPrice, 0);
    const totalCostValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    return { totalItems, lowStockCount, totalInventoryValue, totalCostValue };
  }, [products]);

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInProduct) return;
    const delta = parseInt(stockInQty, 10);
    if (isNaN(delta) || delta <= 0) {
      alert('সঠিক পরিমাণের সংখ্যা লিখুন');
      return;
    }

    onAdjustStock(stockInProduct.id, delta);
    setStockInProduct(null);
    setStockInQty('');
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setNewProdName('');
    setNewBanglaName('');
    setNewSku('');
    setNewCategory(categories[0] || 'তেল ও ঘি');
    setNewSupplier(suppliers[0] || '');
    setShowQuickAddSupplier(false);
    setQuickSupplierName('');
    setNewUnit('কার্টুন');
    setNewUnitPrice('');
    setNewCostPrice('');
    setNewStock('20');
    setNewMinAlert('5');
    setNewTradeOffer('');
    setNewImageUrl('');
    setIsAddProductOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setNewProdName(prod.name || '');
    setNewBanglaName(prod.banglaName || '');
    setNewSku(prod.sku || '');
    setNewCategory(prod.category || (categories[0] || 'তেল ও ঘি'));
    setNewSupplier(prod.supplier || (suppliers[0] || ''));
    setShowQuickAddSupplier(false);
    setQuickSupplierName('');
    setNewUnit(prod.unit || 'কার্টুন');
    setNewUnitPrice(prod.unitPrice !== undefined && prod.unitPrice !== null ? prod.unitPrice.toString() : '');
    setNewCostPrice(prod.costPrice !== undefined && prod.costPrice !== null ? prod.costPrice.toString() : '');
    setNewStock(prod.stock !== undefined && prod.stock !== null ? prod.stock.toString() : '0');
    setNewMinAlert(prod.minStockAlert !== undefined && prod.minStockAlert !== null ? prod.minStockAlert.toString() : '5');
    setNewTradeOffer(prod.tradeOfferDesc || '');
    setNewImageUrl(prod.imageUrl || '');
    setIsAddProductOpen(true);
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCsvFile(file);
    setCsvImportErrors([]);
    setImportSuccessMsg(null);
    setBulkPhotoResult(null);
    setPreviewSearchQuery('');
    setPreviewFilter('all');
    setPreviewPage(1);

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result;
      if (!buffer) return;
      const { products: parsedProds, skippedCount, errors } = parseSpreadsheetFile(
        buffer as ArrayBuffer,
        file.name,
        categories,
        suppliers
      );
      setCsvPreviewProducts(parsedProds);
      setCsvSkippedCount(skippedCount);
      setCsvImportErrors(errors);
    };
    reader.onerror = () => {
      setCsvImportErrors(['ফাইলটি পড়তে সমস্যা হয়েছে']);
    };
    reader.readAsArrayBuffer(file);
  };

  // Bulk Photos Auto-Matcher: Matches multiple selected photos to preview products by SKU or Name
  const handleBulkPhotosSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || csvPreviewProducts.length === 0) return;

    setIsProcessingBulkPhotos(true);
    let matchedCount = 0;
    const updated = [...csvPreviewProducts];

    for (const file of files) {
      try {
        const compressedDataUrl = await processImageFile(file, 400, 32 * 1024);
        const fileNameWithoutExt = file.name
          .substring(0, file.name.lastIndexOf('.') !== -1 ? file.name.lastIndexOf('.') : file.name.length)
          .toLowerCase()
          .trim();

        // 1. Try match by exact or partial SKU
        let targetIdx = updated.findIndex((p) => {
          if (!p.sku) return false;
          const cleanSku = p.sku.toLowerCase().trim();
          return fileNameWithoutExt === cleanSku || fileNameWithoutExt.includes(cleanSku) || cleanSku.includes(fileNameWithoutExt);
        });

        // 2. Try match by Bangla name or English name
        if (targetIdx === -1) {
          targetIdx = updated.findIndex((p) => {
            const bn = (p.banglaName || '').toLowerCase().trim();
            const en = (p.name || '').toLowerCase().trim();
            return (
              (bn && (fileNameWithoutExt.includes(bn) || bn.includes(fileNameWithoutExt))) ||
              (en && (fileNameWithoutExt.includes(en) || en.includes(fileNameWithoutExt)))
            );
          });
        }

        // 3. Try match by row sequence number (e.g., 1.jpg, row-1.png, 12.jpg)
        if (targetIdx === -1) {
          const numOnly = parseInt(fileNameWithoutExt.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(numOnly) && numOnly >= 1 && numOnly <= updated.length) {
            targetIdx = numOnly - 1;
          }
        }

        // 4. Fallback: match first product that doesn't have an image
        if (targetIdx === -1) {
          targetIdx = updated.findIndex((p) => !p.imageUrl);
        }

        if (targetIdx !== -1) {
          updated[targetIdx] = {
            ...updated[targetIdx],
            imageUrl: compressedDataUrl,
          };
          matchedCount++;
        }
      } catch (err) {
        console.warn('Error processing image:', file.name, err);
      }
    }

    setCsvPreviewProducts(updated);
    setIsProcessingBulkPhotos(false);
    setBulkPhotoResult({ matched: matchedCount, total: files.length });
  };

  // Single row photo upload trigger
  const triggerSingleRowPhotoUpload = (prodId: string) => {
    activePhotoRowProdId.current = prodId;
    singleRowPhotoInputRef.current?.click();
  };

  const handleSingleRowPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetId = activePhotoRowProdId.current;
    if (!file || !targetId) return;

    try {
      const compressedDataUrl = await processImageFile(file, 400, 32 * 1024);
      setCsvPreviewProducts((prev) =>
        prev.map((p) => (p.id === targetId ? { ...p, imageUrl: compressedDataUrl } : p))
      );
    } catch (err) {
      console.warn('Failed to compress row photo:', err);
    }
  };

  const handleRemovePhotoFromPreview = (prodId: string) => {
    setCsvPreviewProducts((prev) =>
      prev.map((p) => (p.id === prodId ? { ...p, imageUrl: '' } : p))
    );
  };

  const handleDeletePreviewProduct = (prodId: string) => {
    setCsvPreviewProducts((prev) => prev.filter((p) => p.id !== prodId));
  };

  // Quick cell update in preview table
  const handleUpdatePreviewCell = (
    prodId: string,
    field: 'unitPrice' | 'costPrice' | 'stock' | 'banglaName',
    val: string | number
  ) => {
    setCsvPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.id !== prodId) return p;
        if (field === 'unitPrice' || field === 'costPrice') {
          const num = typeof val === 'number' ? val : parseBanglaNumber(val, p[field]);
          return { ...p, [field]: isNaN(num) ? p[field] : num };
        }
        if (field === 'stock') {
          const num =
            typeof val === 'number'
              ? val
              : Math.max(0, Math.round(parseBanglaNumber(val, p.stock)));
          return { ...p, stock: num };
        }
        return { ...p, [field]: String(val) };
      })
    );
  };

  // Check if preview product matches an existing product in inventory
  const checkExistingMatch = (p: Product): Product | undefined => {
    const sku = (p.sku || '').toLowerCase().trim();
    const name = (p.banglaName || '').toLowerCase().trim();
    return products.find(
      (existing) =>
        (sku && existing.sku && existing.sku.toLowerCase().trim() === sku) ||
        (name && existing.banglaName && existing.banglaName.toLowerCase().trim() === name)
    );
  };

  const handleConfirmBulkImport = () => {
    if (csvPreviewProducts.length === 0) return;
    setIsImportingCsv(true);

    try {
      const existingBySku = new Map(products.map((p) => [p.sku.toLowerCase().trim(), p]));
      const existingByName = new Map(products.map((p) => [p.banglaName.toLowerCase().trim(), p]));

      const toAdd: Product[] = [];
      const toUpdate: Product[] = [];

      csvPreviewProducts.forEach((newProd) => {
        const skuKey = (newProd.sku || '').toLowerCase().trim();
        const nameKey = (newProd.banglaName || '').toLowerCase().trim();
        const matched = (skuKey && existingBySku.get(skuKey)) || (nameKey && existingByName.get(nameKey));

        if (matched) {
          if (duplicateMode === 'skip') {
            return;
          }
          if (duplicateMode === 'update') {
            toUpdate.push({
              ...matched,
              unitPrice: newProd.unitPrice,
              costPrice: newProd.costPrice,
              stock: newProd.stock,
              unit: newProd.unit || matched.unit,
              category: newProd.category || matched.category,
              supplier: newProd.supplier || matched.supplier,
              tradeOfferDesc: newProd.tradeOfferDesc || matched.tradeOfferDesc,
              imageUrl: newProd.imageUrl || matched.imageUrl,
            });
            return;
          }
        }
        toAdd.push(newProd);
      });

      if (toUpdate.length > 0) {
        toUpdate.forEach((p) => {
          if (onUpdateProduct) onUpdateProduct(p);
          else onAddProduct(p);
        });
      }

      if (toAdd.length > 0) {
        if (onBatchAddProducts) {
          onBatchAddProducts(toAdd);
        } else {
          toAdd.forEach((p) => onAddProduct(p));
        }
      }

      const summaryParts: string[] = [];
      if (toAdd.length > 0) summaryParts.push(`${toAdd.length}টি নতুন পণ্য যুক্ত`);
      if (toUpdate.length > 0) summaryParts.push(`${toUpdate.length}টি বিদ্যমান পণ্য আপডেট`);
      if (duplicateMode === 'skip' && csvPreviewProducts.length > toAdd.length) {
        summaryParts.push(`${csvPreviewProducts.length - toAdd.length}টি বিদ্যমান স্কিপ`);
      }

      setImportSuccessMsg(`সফলভাবে সম্পন্ন হয়েছে! (${summaryParts.join(', ')})`);
      setTimeout(() => {
        setIsBulkCsvModalOpen(false);
        setCsvFile(null);
        setCsvPreviewProducts([]);
        setImportSuccessMsg(null);
        setBulkPhotoResult(null);
      }, 1600);
    } catch {
      setCsvImportErrors(['পণ্যগুলো সংরক্ষণ করতে সমস্যা হয়েছে']);
    } finally {
      setIsImportingCsv(false);
    }
  };

  const previewStats = useMemo(() => {
    const total = csvPreviewProducts.length;
    const withImg = csvPreviewProducts.filter((p) => Boolean(p.imageUrl)).length;
    const withoutImg = total - withImg;
    const existingCount = csvPreviewProducts.filter((p) => Boolean(checkExistingMatch(p))).length;
    const newCount = total - existingCount;
    return { total, withImg, withoutImg, existingCount, newCount };
  }, [csvPreviewProducts, products]);

  const filteredPreviewProducts = useMemo(() => {
    return csvPreviewProducts.filter((p) => {
      if (previewSearchQuery.trim()) {
        const q = previewSearchQuery.toLowerCase().trim();
        const matchName =
          (p.banglaName || '').toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchCat = (p.category || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }
      if (previewFilter === 'with-img') return Boolean(p.imageUrl);
      if (previewFilter === 'without-img') return !p.imageUrl;
      return true;
    });
  }, [csvPreviewProducts, previewSearchQuery, previewFilter]);

  const totalPreviewPages = Math.ceil(filteredPreviewProducts.length / previewPerPage) || 1;
  const paginatedPreviewProducts = useMemo(() => {
    if (previewPerPage >= 9999) return filteredPreviewProducts;
    const start = (previewPage - 1) * previewPerPage;
    return filteredPreviewProducts.slice(start, start + previewPerPage);
  }, [filteredPreviewProducts, previewPage, previewPerPage]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingImage(true);
    setUploadStatusMsg(null);
    try {
      const compressedDataUrl = await processImageFile(file, 400, 30 * 1024);
      const kb = Math.max(1, Math.round((compressedDataUrl.length * 0.75) / 1024));
      setNewImageUrl(compressedDataUrl);
      setUploadStatusMsg({ text: `ছবি সফলভাবে অপ্টিমাইজ হয়েছে! সাইজ মাত্র ${kb} KB (ডাটা সাশ্রয়ী)`, isError: false });
    } catch (err: any) {
      setUploadStatusMsg({ text: err?.message || 'ছবি আপলোড করতে সমস্যা হয়েছে', isError: true });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleProductFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingImage) return;
    if (!newBanglaName.trim() && !newProdName.trim()) {
      setUploadStatusMsg({ text: 'পণ্যের নাম আবশ্যক', isError: true });
      return;
    }

    const unitPriceNum = Math.max(0, parseBanglaNumber(newUnitPrice, 0));
    if (unitPriceNum <= 0) {
      setUploadStatusMsg({ text: 'বিক্রয় রেট (৳) সঠিকভাবে লিখুন', isError: true });
      return;
    }
    const rawCost = parseBanglaNumber(newCostPrice, -1);
    const costPriceNum = rawCost >= 0 ? rawCost : Math.max(0, Math.round(unitPriceNum * 0.9));
    const rawStock = newStock.trim() === '' ? (editingProduct ? editingProduct.stock : 50) : parseBanglaNumber(newStock, 0);
    const stockNum = Math.max(0, Math.round(rawStock));
    const minAlertNum = Math.max(1, Math.round(parseBanglaNumber(newMinAlert, 5)));

    if (editingProduct && onUpdateProduct) {
      const updated: Product = {
        ...editingProduct,
        id: editingProduct.id,
        name: newProdName.trim() || newBanglaName.trim(),
        banglaName: newBanglaName.trim() || newProdName.trim(),
        sku: newSku.trim() || editingProduct.sku,
        category: newCategory || 'সাবান ও ডিটারজেন্ট',
        supplier: newSupplier.trim() || undefined,
        unit: newUnit || 'পিস',
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: newTradeOffer.trim() || '',
        imageUrl: newImageUrl.trim() || editingProduct.imageUrl || '',
      };
      onUpdateProduct(updated);
    } else {
      const created: Product = {
        id: `prod-${Date.now()}`,
        name: newProdName.trim() || newBanglaName.trim(),
        banglaName: newBanglaName.trim() || newProdName.trim(),
        sku: newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category: newCategory || 'সাবান ও ডিটারজেন্ট',
        supplier: newSupplier.trim() || undefined,
        unit: newUnit || 'পিস',
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: newTradeOffer.trim() || '',
        imageUrl:
          newImageUrl.trim() ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      };
      onAddProduct(created);
      setSearch('');
      setCategoryFilter('all');
      setSupplierFilter('all');
    }

    setIsAddProductOpen(false);
    setEditingProduct(null);
    setNewProdName('');
    setNewBanglaName('');
    setNewSku('');
    setNewSupplier('');
    setShowQuickAddSupplier(false);
    setQuickSupplierName('');
    setNewUnitPrice('');
    setNewCostPrice('');
    setNewStock('');
    setNewTradeOffer('');
    setNewImageUrl('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">মোট প্রোডাক্ট SKU</p>
          <p className="text-2xl font-black text-neutral-900 mt-1">{metrics.totalItems}টি</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">{categories.length}টি ক্যাটাগরিতে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">স্টক সতর্কতা (Low Stock)</p>
          <p className={`text-2xl font-black mt-1 ${metrics.lowStockCount > 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
            {metrics.lowStockCount}টি আইটেম
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">রি-অর্ডার লেভেলের নিচে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">ইনভেন্টরি বাজার মূল্য</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            ৳{metrics.totalInventoryValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">বর্তমান বিক্রয় দরে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">আনুমানিক ক্রয় মূল্য</p>
          <p className="text-2xl font-black text-neutral-800 mt-1">
            ৳{metrics.totalCostValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            সম্ভাব্য লাভ: ৳{(metrics.totalInventoryValue - metrics.totalCostValue).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="পণ্য, বাংলা নাম বা SKU কোড দিয়ে সার্চ..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs py-2 px-2.5 border border-neutral-300 rounded-xl bg-neutral-50 font-medium text-neutral-800"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-xs py-2 px-2.5 border border-neutral-300 rounded-xl bg-neutral-50 font-medium text-neutral-800"
          >
            <option value="all">সকল সাপ্লায়ার</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="other">অন্যান্য / অনির্দিষ্ট</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            type="button"
            onClick={() => downloadInventoryXLSX(products)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="সকল প্রোডাক্ট ও ইনভেন্টরি মাইক্রোসফট এক্সেল (.xlsx) ফাইলে ডাউনলোড করুন"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>এক্সেল (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => downloadInventoryCSV(products)}
            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 transition-colors flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
            title="CSV ফরম্যাটে ইনভেন্টরি ডাউনলোড"
          >
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={downloadProductTemplateCSV}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="১০০+ পণ্য আমদানির MunsiStore_Product_Import_Template.csv টেমপ্লেট ডাউনলোড করুন"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>নমুনা CSV (.csv)</span>
          </button>

          <button
            type="button"
            onClick={downloadProductTemplateXLSX}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="১০০+ পণ্য বাল্ক আপলোডের নমুনা এক্সেল (.xlsx) টেমপ্লেট ডাউনলোড করুন"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>নমুনা এক্সেল</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCsvFile(null);
              setCsvPreviewProducts([]);
              setCsvImportErrors([]);
              setImportSuccessMsg(null);
              setIsBulkCsvModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white border border-teal-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="এক্সেল (.xlsx/.xls) বা CSV ফাইল থেকে একসাথে ১০০+ পণ্য আপলোড করুন"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-100" />
            <span>বাল্ক আপলোড (Excel/CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSupplierSummaryOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="সাপ্লায়ার ভিত্তিক স্টক ও ইনভেন্টরি সামারি"
          >
            <PieChart className="w-3.5 h-3.5 text-indigo-600" />
            <span>সাপ্লায়ার সামারি</span>
          </button>

          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
              onlyLowStock
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>কম স্টক ফিল্টার</span>
          </button>

          {onCleanAllMockData && products.some((p) => DEMO_PRODUCT_IDS.includes(p.id)) && (
            <button
              type="button"
              onClick={() => {
                onCleanAllMockData();
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              title="সকল ডেমো পণ্য মুছে ফেলুন"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>ডেমো ডাটা মুছুন</span>
            </button>
          )}

          <button
            onClick={openAddProductModal}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন পণ্য</span>
          </button>
        </div>
      </div>

      {/* Bulk & Select Print Bar for Products */}
      {filteredProducts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
          <div>
            <p className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>১-ক্লিকে অথবা সিলেক্ট করে প্রোডাক্ট মূল্য ও স্টক তালিকা প্রিন্ট ({filteredProducts.length}টি পণ্য)</span>
            </p>
            <p className="text-[11px] text-blue-700">
              টেবিল থেকে পণ্যে টিক চিহ্ন দিয়ে বাছাই করে প্রিন্ট করুন অথবা ১-ক্লিকে সম্পূর্ণ প্রাইস ও স্টক লিস্ট প্রিন্ট করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const allSelected =
                  filteredProducts.length > 0 &&
                  filteredProducts.every((p) => selectedProductIds.has(p.id));
                if (allSelected) {
                  setSelectedProductIds(new Set());
                } else {
                  setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {filteredProducts.length > 0 &&
              filteredProducts.every((p) => selectedProductIds.has(p.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-blue-400" />
              )}
              <span>
                {filteredProducts.length > 0 &&
                filteredProducts.every((p) => selectedProductIds.has(p.id))
                  ? 'সব আন-সিলেক্ট'
                  : `সব সিলেক্ট (${filteredProducts.length})`}
              </span>
            </button>

            {selectedProductIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  const chosen = products.filter((p) => selectedProductIds.has(p.id));
                  printProductsBatch(chosen, `(নির্বাচিত ${chosen.length} টি পণ্য)`);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>নির্বাচিত ({selectedProductIds.size}টি) প্রিন্ট</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => printProductsBatch(filteredProducts, `(${filteredProducts.length} টি পণ্য)`)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>১-ক্লিকে সব প্রিন্ট ({filteredProducts.length}টি)</span>
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table / Cards */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">পণ্য ও SKU</th>
                <th className="py-3 px-3">ক্যাটাগরি</th>
                <th className="py-3 px-3">সাপ্লায়ার / কোম্পানি</th>
                <th className="py-3 px-3 text-right">ক্রয় দর</th>
                <th className="py-3 px-3 text-right">বিক্রয় দর</th>
                <th className="py-3 px-3 text-center">বর্তমান স্টক</th>
                <th className="py-3 px-3 text-center">অ্যালার্ট লেভেল</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.map((prod) => {
                const isLow = prod.stock <= prod.minStockAlert;
                const margin = prod.unitPrice - prod.costPrice;
                const marginPct = prod.costPrice > 0 ? Math.round((margin / prod.costPrice) * 100) : 0;
                const isSelected = selectedProductIds.has(prod.id);

                return (
                  <tr
                    key={prod.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-neutral-50/80'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSelectProduct(prod.id)}
                          className="text-neutral-400 hover:text-blue-600 shrink-0 cursor-pointer"
                          title="প্রিন্টের জন্য সিলেক্ট করুন"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div
                          onClick={() => prod.imageUrl && setLightboxProduct(prod)}
                          title="ফুল ছবি দেখতে ক্লিক করুন"
                          className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#FAFBFD] via-[#F4F5F8] to-[#EAEDF2] border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center p-1 cursor-pointer hover:border-[#E21E26] hover:shadow-xs transition-all"
                        >
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.banglaName}
                              className="w-full h-full object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900 text-sm">{prod.banglaName}</p>
                          <p className="text-neutral-500 text-[11px]">
                            {prod.name} <span className="text-neutral-400">({prod.sku})</span>
                          </p>
                          {prod.tradeOfferDesc && (
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
                              {prod.tradeOfferDesc}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-medium text-[11px]">
                        {prod.category}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {prod.supplier ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{prod.supplier}</span>
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-[11px] italic">অনির্দিষ্ট</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-neutral-600">
                      ৳{prod.costPrice} / {prod.unit}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <p className="font-bold text-neutral-900">৳{prod.unitPrice}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">+{marginPct}% মার্জিন</p>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                          prod.stock === 0
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {prod.stock} {prod.unit}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-neutral-500">
                      ≤ {prod.minStockAlert} {prod.unit}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => printProductsBatch([prod], `(${prod.banglaName})`)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          title="এই পণ্যটি ১-ক্লিকে প্রিন্ট করুন"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-emerald-700 rounded-lg border border-neutral-200 transition-colors"
                          title="পণ্য এডিট করুন"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockInProduct(prod)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          title="স্টক বৃদ্ধি করুন"
                        >
                          + স্টক
                        </button>
                        {onDeleteProduct && (
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(prod.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            title="পণ্য ডিলিট করুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock In Modal */}
      {stockInProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-1">নতুন স্টক গ্রহণ / সমন্বয়</h3>
            <p className="text-xs text-neutral-500 mb-3">{stockInProduct.banglaName}</p>

            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mb-3 text-xs flex justify-between items-center">
              <span className="text-neutral-600 font-medium">বর্তমান বিদ্যমান স্টক:</span>
              <span className="font-bold text-emerald-800 text-sm">
                {stockInProduct.stock} {stockInProduct.unit}
              </span>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  নতুন আগত পরিমাণ ({stockInProduct.unit}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  placeholder="যেমন: ২০"
                  className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockInProduct(null)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow"
                >
                  স্টকে যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-neutral-200 max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-neutral-200 bg-white shrink-0">
              <h3 className="font-bold text-sm sm:text-base text-neutral-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{editingProduct ? 'পণ্যের তথ্য ও মূল্য সম্পাদনা' : 'নতুন পণ্য ক্যাটালগে যুক্ত করুন'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddProductOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div
                className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {productFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-bold text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{productFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">
                      পণ্যের বাংলা নাম <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newBanglaName}
                      onChange={(e) => setNewBanglaName(e.target.value)}
                      placeholder="যেমন: ফ্রেশ সয়াবিন তেল (১ লিটার)"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">ইংরেজি নাম</label>
                    <input
                      type="text"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="Fresh Soybean Oil 1L"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">ক্যাটাগরি</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-medium focus:outline-none focus:border-emerald-600"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!categories.includes(newCategory) && newCategory && (
                        <option value={newCategory}>{newCategory}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-neutral-700 block">
                        সাপ্লায়ার / কোম্পানি
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddSupplier(!showQuickAddSupplier)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>{showQuickAddSupplier ? 'লিস্ট থেকে বাছুন' : '+ নতুন সাপ্লায়ার'}</span>
                      </button>
                    </div>

                    {showQuickAddSupplier ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={quickSupplierName}
                          onChange={(e) => setQuickSupplierName(e.target.value)}
                          placeholder="কোম্পানির নাম (যেমন: তীর / সিটি গ্রুপ)"
                          className="flex-1 p-2 border border-indigo-300 rounded-xl bg-indigo-50/40 text-xs font-bold text-neutral-900 focus:outline-none focus:border-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={handleSaveQuickSupplier}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          যোগ
                        </button>
                      </div>
                    ) : (
                      <select
                        value={newSupplier}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setShowQuickAddSupplier(true);
                          } else {
                            setNewSupplier(e.target.value);
                          }
                        }}
                        className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-medium focus:outline-none focus:border-emerald-600"
                      >
                        <option value="">-- সাপ্লায়ার নির্বাচন করুন --</option>
                        {suppliers.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {newSupplier && !suppliers.includes(newSupplier) && (
                          <option value={newSupplier}>{newSupplier}</option>
                        )}
                        <option value="__add_new__" className="text-indigo-600 font-bold">
                          + নতুন সাপ্লায়ার যোগ করুন...
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">
                      একক (Unit) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-medium focus:outline-none focus:border-emerald-600"
                    >
                      <option value="কার্টুন">কার্টুন</option>
                      <option value="বস্তা">বস্তা</option>
                      <option value="ডজন">ডজন</option>
                      <option value="কেজি">কেজি</option>
                      <option value="পিস">পিস</option>
                      <option value="প্যাকেট">প্যাকেট</option>
                      <option value="বক্স">বক্স</option>
                      <option value="বোতল">বোতল</option>
                      <option value="লিটার">লিটার</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">SKU কোড</label>
                    <input
                      type="text"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value)}
                      placeholder="OIL-FRSH-1L"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">
                      বিক্রয় রেট (৳) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={newUnitPrice}
                      onChange={(e) => setNewUnitPrice(e.target.value)}
                      placeholder="১৯৫০"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-bold font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">
                      ক্রয় রেট (৳) (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newCostPrice}
                      onChange={(e) => setNewCostPrice(e.target.value)}
                      placeholder="১৮০০"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">বর্তমান স্টক</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      placeholder="৫০"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">অ্যালার্ট লেভেল</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newMinAlert}
                      onChange={(e) => setNewMinAlert(e.target.value)}
                      placeholder="১০"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">ট্রেড অফার / স্কিম (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={newTradeOffer}
                    onChange={(e) => setNewTradeOffer(e.target.value)}
                    placeholder="যেমন: ১০ কার্টুনে ১ কার্টুন ফ্রি"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    প্রোডাক্ট ছবি লিংক (Image URL) অথবা ক্যামেরা/গ্যালারি থেকে সরাসরি আপলোড
                  </label>
                  <p className="text-[11px] text-emerald-800 font-medium mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                    <span>ক্যামেরা বা গ্যালারি থেকে ৩-৫ MB বড় ছবি দিলেও ব্রাউজারে স্বয়ংক্রিয়ভাবে WebP/JPEG ফরম্যাটে অপ্টিমাইজড ও কম্প্রেস হয়ে যাবে (ডাটা সাশ্রয়ী)।</span>
                  </p>
                  <div className="flex gap-2 items-stretch">
                    <input
                      type="text"
                      value={newImageUrl.startsWith('data:') ? '' : newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder={
                        newImageUrl.startsWith('data:')
                          ? '✅ ডিভাইস থেকে ছবি যুক্ত হয়েছে (অথবা নতুন লিংক পেস্ট করুন)'
                          : 'https://images.unsplash.com/...'
                      }
                      className="flex-1 p-2.5 border border-neutral-300 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600"
                    />
                    <div className="relative shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        id="inventory-image-upload-file"
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="inventory-image-upload-file"
                        className={`flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors h-full ${
                          isUploadingImage
                            ? 'bg-emerald-700 text-white opacity-75 cursor-wait'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingImage ? 'প্রসেস হচ্ছে...' : 'আপলোড'}</span>
                      </label>
                    </div>
                  </div>

                  {uploadStatusMsg && (
                    <p className={`mt-1.5 text-[11px] font-bold ${uploadStatusMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {uploadStatusMsg.text}
                    </p>
                  )}

                  {newImageUrl && (
                    <div className="mt-2 p-2 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center gap-2.5">
                      <img src={newImageUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-emerald-300 bg-white shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-emerald-800 font-bold block truncate">✅ ছবি প্রস্তুত রয়েছে</span>
                        <span className="text-[10px] text-neutral-500 font-mono block truncate">
                          {newImageUrl.startsWith('data:')
                            ? `ডিভাইস থেকে আপলোড করা ছবি (${Math.round((newImageUrl.length * 0.75) / 1024)} KB)`
                            : newImageUrl}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewImageUrl('');
                          setUploadStatusMsg(null);
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 shrink-0"
                      >
                        রিমুভ
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
                {editingProduct && onDeleteProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`আপনি কি '${editingProduct.banglaName}' পণ্যটি মুছে ফেলতে চান?`)) {
                        onDeleteProduct(editingProduct.id);
                        setIsAddProductOpen(false);
                        setEditingProduct(null);
                      }
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center gap-1 border border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>পণ্য মুছুন</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddProductOpen(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 text-neutral-600 hover:bg-neutral-200/70 rounded-xl font-semibold"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingImage}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow transition-colors disabled:opacity-50"
                  >
                    {isUploadingImage
                      ? 'ছবি প্রসেস হচ্ছে...'
                      : editingProduct
                      ? 'আপডেট সেভ করুন'
                      : 'পণ্য সংরক্ষণ করুন'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {isBulkCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
          {/* Hidden inputs for photo selection */}
          <input
            ref={bulkPhotosInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleBulkPhotosSelect}
            className="hidden"
          />
          <input
            ref={singleRowPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleSingleRowPhotoUpload}
            className="hidden"
          />

          <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-neutral-200 my-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-neutral-900">
                    এক্সেল / CSV দিয়ে ১০০+ পণ্য বাল্ক আপলোড ও ছবি যুক্তকরণ
                  </h3>
                  <p className="text-xs text-neutral-500">
                    স্প্রেডশীট ফাইল থেকে একসাথে বহুসংখ্যক পণ্য প্রিভিউ করুন ও প্রতিটিতে সহজে ছবি যুক্ত করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkCsvModalOpen(false);
                  setCsvFile(null);
                  setCsvPreviewProducts([]);
                  setCsvImportErrors([]);
                  setBulkPhotoResult(null);
                }}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Step 1: Download Sample Template */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <span>১. ডেমো এক্সেল / CSV টেমপ্লেট ডাউনলোড করুন</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">
                      ছবির লিংক কলাম সহ
                    </span>
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    টেমপ্লেটে পণ্যের বাংলা নাম, ক্যাটাগরি, বিক্রয়মূল্য, কেনাদর, স্টক এবং <b>&quot;ছবির লিংক (Image URL)&quot;</b> কলাম দেওয়া আছে।
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadProductTemplateCSV}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    title="MunsiStore_Product_Import_Template.csv ডাউনলোড করুন"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-200" />
                    <span>নমুনা CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadProductTemplateXLSX}
                    className="px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    title="MunsiStore_Product_Import_Template.xlsx ডাউনলোড করুন"
                  >
                    <span>এক্সেল (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Choose File */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  ২. প্রস্তুতকৃত Excel (.xlsx / .xls) বা CSV ফাইল আপলোড করুন
                </label>
                <div className="border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-2xl p-5 text-center bg-teal-50/20 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    id="bulk-product-csv-input"
                    onChange={handleCsvFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="bulk-product-csv-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <FileUp className="w-7 h-7 text-teal-600" />
                    <span className="text-xs font-bold text-teal-900">
                      {csvFile ? `ফাইল সিলেক্ট হয়েছে: ${csvFile.name}` : 'ফাইল সিলেক্ট করতে এখানে ক্লিক করুন (.xlsx বা .csv)'}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Microsoft Excel (.xlsx/.xls) অথবা CSV ফাইল সরাসরি ড্রপ করুন
                    </span>
                  </label>
                </div>
              </div>

              {/* Status messages */}
              {importSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {csvImportErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>কিছু লাইনে ত্রুটি পাওয়া গেছে:</span>
                  </span>
                  <ul className="list-disc pl-5 text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                    {csvImportErrors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {csvImportErrors.length > 5 && (
                      <li>...আরও {csvImportErrors.length - 5}টি ত্রুটি</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Photo Options Info Banner */}
              {csvPreviewProducts.length > 0 && (
                <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-blue-50 border border-teal-200/80 rounded-2xl p-3 sm:p-3.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                          <span>বাল্ক আপলোডে ছবি যুক্ত করার ৩টি সুবিধা</span>
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                            WebP অপ্টিমাইজড
                          </span>
                        </h4>
                        <p className="text-[11px] text-teal-800">
                          ছবি যুক্ত: <span className="font-bold text-teal-950">{previewStats.withImg}</span> / {previewStats.total}টি পণ্য
                          {previewStats.withoutImg > 0 && ` (${previewStats.withoutImg}টিতে ছবি বাকি)`}
                        </p>
                      </div>
                    </div>

                    {/* Bulk Photo Match Action Button */}
                    <button
                      type="button"
                      disabled={isProcessingBulkPhotos}
                      onClick={() => bulkPhotosInputRef.current?.click()}
                      className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {isProcessingBulkPhotos
                          ? 'ছবিগুলো অপ্টিমাইজ হচ্ছে...'
                          : '📸 এক ক্লিকে সব ছবি অটো-ম্যাচ করুন'}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-600 pt-1.5 border-t border-teal-200/60">
                    <div className="bg-white/80 p-2 rounded-xl border border-teal-100">
                      <span className="font-bold text-teal-900 block mb-0.5">১. ফাইলে ছবির লিংক:</span>
                      স্প্রেডশীটের &quot;ছবির লিংক&quot; কলামে পণ্যের অনলাইন ইউআরএল দিলেই ছবি স্বয়ংক্রিয়ভাবে লোড হবে।
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-teal-100">
                      <span className="font-bold text-teal-900 block mb-0.5">২. একসাথে সব ছবি অটো-ম্যাচ:</span>
                      ডিভাইস থেকে ৫০-১০০টি ছবি একসাথে সিলেক্ট করুন। ফাইলের নাম (SKU / নাম / ক্রমিক নম্বর) অনুযায়ী ক্লায়েন্ট-সাইডেই WebP কম্প্রেস হয়ে বসে যাবে।
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-teal-100">
                      <span className="font-bold text-teal-900 block mb-0.5">৩. টেবিলে সরাসরি ছবি তোলা:</span>
                      নিচের টেবিলে যেকোনো পণ্যের পাশে থাকা &quot;+ ছবি&quot; বাটনে ক্লিক করে ক্যামেরা দিয়ে ছবি তুলতে বা সিলেক্ট করতে পারেন।
                    </div>
                  </div>

                  {bulkPhotoResult && (
                    <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
                      <span>
                        🎉 {bulkPhotoResult.total}টি ছবির মধ্যে {bulkPhotoResult.matched}টি পণ্যে ছবি সফলভাবে ম্যাচ ও কম্প্রেস হয়েছে!
                      </span>
                      <button
                        type="button"
                        onClick={() => setBulkPhotoResult(null)}
                        className="text-emerald-700 hover:text-emerald-950 text-[11px] underline cursor-pointer"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Handling Policy */}
              {csvPreviewProducts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-blue-50/80 rounded-2xl border border-blue-200">
                  <div>
                    <span className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                      <span>স্মার্ট ডুপ্লিকেট পলিসি:</span>
                      <span className="text-[10px] bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                        {previewStats.existingCount}টি পণ্য আগে থেকেই ইনভেন্টরিতে আছে
                      </span>
                    </span>
                    <span className="text-[11px] text-blue-800 block">
                      একই SKU বা বাংলা নামের পণ্য পাওয়া গেলে আপনি কী করতে চান?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => setDuplicateMode('update')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        duplicateMode === 'update'
                          ? 'bg-blue-800 text-white shadow-xs'
                          : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      🔄 বিদ্যমানগুলো আপডেট (রেট ও স্টক)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateMode('skip')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        duplicateMode === 'skip'
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      ⏭️ বিদ্যমানগুলো স্কিপ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateMode('add_new')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        duplicateMode === 'add_new'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      ➕ সব নতুন হিসেবে যোগ
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Interactive Preview Table for 100+ Products */}
              {csvPreviewProducts.length > 0 && (
                <div className="space-y-3">
                  {/* Filter and Search Bar inside Preview */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-neutral-50 p-2.5 rounded-2xl border border-neutral-200">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={previewSearchQuery}
                        onChange={(e) => {
                          setPreviewSearchQuery(e.target.value);
                          setPreviewPage(1);
                        }}
                        placeholder="১০০+ পণ্যের মধ্যে নাম, SKU বা ক্যাটাগরি দিয়ে খুঁজুন..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-neutral-200 focus:outline-hidden focus:border-teal-500"
                      />
                    </div>

                    {/* Filter Chips */}
                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('all');
                          setPreviewPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          previewFilter === 'all'
                            ? 'bg-teal-800 text-white'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        সব ({previewStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('with-img');
                          setPreviewPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          previewFilter === 'with-img'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        ছবি যুক্ত ({previewStats.withImg})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('without-img');
                          setPreviewPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          previewFilter === 'without-img'
                            ? 'bg-amber-700 text-white'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        ছবি ছাড়া ({previewStats.withoutImg})
                      </button>
                    </div>

                    {/* Per Page Selector */}
                    <div className="flex items-center gap-1 shrink-0 text-xs text-neutral-600">
                      <span className="hidden sm:inline text-[11px]">প্রতি পেজে:</span>
                      <select
                        value={previewPerPage}
                        onChange={(e) => {
                          setPreviewPerPage(parseInt(e.target.value, 10));
                          setPreviewPage(1);
                        }}
                        className="px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-hidden"
                      >
                        <option value={25}>২৫টি</option>
                        <option value={50}>৫০টি</option>
                        <option value={100}>১০০টি</option>
                        <option value={9999}>সব একসাথে ({csvPreviewProducts.length})</option>
                      </select>
                    </div>
                  </div>

                  {/* The Preview Table */}
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-100/90 backdrop-blur-xs text-neutral-700 font-extrabold sticky top-0 border-b border-neutral-200 z-10">
                          <tr>
                            <th className="p-2.5 w-10 text-center">#</th>
                            <th className="p-2.5 w-24 text-center">ছবি (Photo)</th>
                            <th className="p-2.5 min-w-[160px]">পণ্যের নাম ও স্ট্যাটাস</th>
                            <th className="p-2.5 min-w-[90px]">এসকেইউ (SKU)</th>
                            <th className="p-2.5 min-w-[100px]">ক্যাটাগরি</th>
                            <th className="p-2.5 min-w-[95px] text-right">বিক্রয় রেট (৳)</th>
                            <th className="p-2.5 min-w-[80px] text-right">কেনাদর</th>
                            <th className="p-2.5 min-w-[95px] text-center">স্টক ও একক</th>
                            <th className="p-2.5 w-12 text-center">মুছুন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium bg-white">
                          {paginatedPreviewProducts.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-6 text-center text-neutral-400">
                                কোনো পণ্য পাওয়া যায়নি
                              </td>
                            </tr>
                          ) : (
                            paginatedPreviewProducts.map((p, idx) => {
                              const globalIndex = (previewPage - 1) * (previewPerPage === 9999 ? 0 : previewPerPage) + idx + 1;
                              const existingMatch = checkExistingMatch(p);
                              return (
                                <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                                  {/* # */}
                                  <td className="p-2.5 text-center text-neutral-400 font-mono text-[11px]">
                                    {globalIndex}
                                  </td>

                                  {/* Image with Direct Upload / Replace / Remove */}
                                  <td className="p-2 text-center">
                                    {p.imageUrl ? (
                                      <div className="relative inline-block group">
                                        <img
                                          src={p.imageUrl}
                                          alt={p.banglaName}
                                          className="w-10 h-10 rounded-xl object-cover border border-teal-200 shadow-2xs mx-auto"
                                        />
                                        <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            title="ছবি পরিবর্তন করুন"
                                            onClick={() => triggerSingleRowPhotoUpload(p.id)}
                                            className="p-1 bg-white/90 text-teal-800 rounded-lg hover:bg-white cursor-pointer"
                                          >
                                            <Camera className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            title="ছবি মুছুন"
                                            onClick={() => handleRemovePhotoFromPreview(p.id)}
                                            className="p-1 bg-white/90 text-rose-600 rounded-lg hover:bg-white cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => triggerSingleRowPhotoUpload(p.id)}
                                        className="px-2 py-1.5 rounded-xl border border-dashed border-teal-300 bg-teal-50/60 hover:bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer transition-colors shadow-2xs"
                                        title="এই পণ্যের ছবি তুলুন বা গ্যালারি থেকে সিলেক্ট করুন"
                                      >
                                        <Camera className="w-3 h-3 text-teal-600" />
                                        <span>+ ছবি</span>
                                      </button>
                                    )}
                                  </td>

                                  {/* Product Name & Existing Status */}
                                  <td className="p-2.5">
                                    <div className="font-extrabold text-neutral-900 leading-tight">
                                      {p.banglaName}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {p.name && p.name !== p.banglaName && (
                                        <span className="text-[11px] text-neutral-400 font-normal">
                                          {p.name}
                                        </span>
                                      )}
                                      {existingMatch ? (
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                            duplicateMode === 'update'
                                              ? 'bg-blue-100 text-blue-800'
                                              : duplicateMode === 'skip'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-purple-100 text-purple-800'
                                          }`}
                                          title={`ইনভেন্টরিতে স্টক: ${existingMatch.stock}, পূর্বের রেট: ৳${existingMatch.unitPrice}`}
                                        >
                                          {duplicateMode === 'update'
                                            ? `বিদ্যমান (স্টক: ${existingMatch.stock})`
                                            : duplicateMode === 'skip'
                                            ? 'স্কিপ হবে'
                                            : 'ডুপ্লিকেট'}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                          নতুন পণ্য
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* SKU */}
                                  <td className="p-2.5">
                                    <span className="font-mono text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                                      {p.sku || '-'}
                                    </span>
                                  </td>

                                  {/* Category */}
                                  <td className="p-2.5">
                                    <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-100 text-neutral-700">
                                      {p.category}
                                    </span>
                                  </td>

                                  {/* Inline Editable Selling Rate */}
                                  <td className="p-2 text-right">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <span className="text-emerald-700 font-bold text-xs">৳</span>
                                      <input
                                        type="text"
                                        value={p.unitPrice}
                                        onChange={(e) =>
                                          handleUpdatePreviewCell(p.id, 'unitPrice', e.target.value)
                                        }
                                        className="w-16 text-right font-extrabold text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50 focus:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-600 rounded px-1.5 py-0.5 text-xs transition-colors"
                                        title="ক্লিক করে বিক্রয়মূল্য এডিট করুন"
                                      />
                                    </div>
                                  </td>

                                  {/* Cost Price */}
                                  <td className="p-2 text-right">
                                    <input
                                      type="text"
                                      value={p.costPrice}
                                      onChange={(e) =>
                                        handleUpdatePreviewCell(p.id, 'costPrice', e.target.value)
                                      }
                                      className="w-14 text-right text-neutral-600 bg-transparent hover:bg-neutral-100 focus:bg-white border border-transparent hover:border-neutral-300 focus:border-teal-500 rounded px-1 py-0.5 text-xs transition-colors"
                                      title="ক্লিক করে কেনাদর এডিট করুন"
                                    />
                                  </td>

                                  {/* Inline Editable Stock & Unit */}
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="text"
                                        value={p.stock}
                                        onChange={(e) =>
                                          handleUpdatePreviewCell(p.id, 'stock', e.target.value)
                                        }
                                        className="w-14 text-center font-bold text-neutral-800 bg-neutral-100/60 hover:bg-neutral-100 focus:bg-white border border-transparent hover:border-neutral-300 focus:border-teal-600 rounded px-1 py-0.5 text-xs transition-colors"
                                        title="ক্লিক করে স্টক এডিট করুন"
                                      />
                                      <span className="text-[10px] text-neutral-500">{p.unit}</span>
                                    </div>
                                  </td>

                                  {/* Delete row */}
                                  <td className="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePreviewProduct(p.id)}
                                      title="এই সারিটি তালিকা থেকে বাদ দিন"
                                      className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPreviewPages > 1 && previewPerPage !== 9999 && (
                      <div className="bg-neutral-50 px-3 py-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
                        <div className="text-[11px]">
                          দেখাচ্ছে {(previewPage - 1) * previewPerPage + 1} থেকে{' '}
                          {Math.min(previewPage * previewPerPage, filteredPreviewProducts.length)} (মোট{' '}
                          {filteredPreviewProducts.length}টি পণ্য)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={previewPage === 1}
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            className="p-1 rounded-lg border border-neutral-200 bg-white disabled:opacity-30 hover:bg-neutral-100 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-neutral-800 text-xs">
                            {previewPage} / {totalPreviewPages}
                          </span>
                          <button
                            type="button"
                            disabled={previewPage === totalPreviewPages}
                            onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                            className="p-1 rounded-lg border border-neutral-200 bg-white disabled:opacity-30 hover:bg-neutral-100 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-100 shrink-0">
              <div className="text-xs text-neutral-500">
                {csvPreviewProducts.length > 0 && (
                  <span>
                    মোট <b>{csvPreviewProducts.length}টি</b> পণ্যের মধ্যে{' '}
                    <b className="text-teal-800">{previewStats.withImg}টি</b> পণ্যে ছবি যুক্ত রয়েছে।
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkCsvModalOpen(false);
                    setCsvFile(null);
                    setCsvPreviewProducts([]);
                    setCsvImportErrors([]);
                    setBulkPhotoResult(null);
                  }}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={csvPreviewProducts.length === 0 || isImportingCsv}
                  onClick={handleConfirmBulkImport}
                  className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isImportingCsv
                      ? 'ইনভেন্টরিতে সংরক্ষণ হচ্ছে...'
                      : `একত্রে ${csvPreviewProducts.length}টি পণ্য ইনভেন্টরিতে সংরক্ষণ করুন`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      <ProductImageLightboxModal
        isOpen={!!lightboxProduct}
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
      />

      {/* Supplier Summary Modal */}
      <SupplierSummaryModal
        isOpen={isSupplierSummaryOpen}
        onClose={() => setIsSupplierSummaryOpen(false)}
        products={products}
        suppliersList={suppliersList}
        onSelectSupplierFilter={(sup) => {
          setSupplierFilter(sup);
        }}
        onAddSupplier={onAddSupplier}
      />
    </div>
  );
};
