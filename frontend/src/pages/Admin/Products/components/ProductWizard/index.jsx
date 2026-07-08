import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Save, Upload, Plus, Trash2, 
  CheckCircle, Image as ImageIcon, Video as VideoIcon, 
  HelpCircle, Eye, RefreshCw, FileText, Sparkles
} from 'lucide-react';
import { adminService } from '../../../../../services/adminService.js';
import { addProduct, getProduct } from '../../../../../services/productService.js';
import { ROUTES } from '../../../../../constants/routes.js';
import { useToast } from '../../../../../hooks/useToast.js';
import { Spinner } from '../../../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../../../utils/extractErrorMessage.js';
import './index.css';

const STEPS = [
  { id: 1, title: 'Basic Information' },
  { id: 2, title: 'Media Upload' },
  { id: 3, title: 'Variant Builder' },
  { id: 4, title: 'Inventory Settings' },
  { id: 5, title: 'Specifications' },
  { id: 6, title: 'Shipping Details' },
  { id: 7, title: 'Warranty & Returns' },
  { id: 8, title: 'Preview & Publish' }
];

export default function ProductWizard({ mode = 'create', productId = null }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Wizard active step
  const [activeStep, setActiveStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    product_name: '',
    brand: '',
    category: '',
    supplier_id: '',
    description: '',
    short_description: '',
    slug: '',
    selling_price: '',
    cost_price: '',
    mrp: '',
    badge: '',
    product_status: 'draft',
    media: {
      cover: '',
      coverAlt: '',
      gallery: [],
      galleryAlts: [],
      video: '',
      videoAlt: '',
      variantMedia: [] // Array of { size, color, file_path, alt_text }
    },
    variants: [], // Array of variant objects
    specifications: [], // Array of { name, value }
    warranty: {
      warranty_period: '1 Year',
      warranty_type: 'Manufacturer',
      replacement_days: 7,
      return_days: 10,
      description: ''
    },
    shipping: {
      weight: '',
      length: '',
      width: '',
      height: '',
      shipping_class: 'Standard',
      cod_available: 1,
      free_shipping: 0
    }
  });

  // Variant Builder parameters
  const [hasVariants, setHasVariants] = useState(false);
  const [variantAttributes, setVariantAttributes] = useState({
    size: false,
    color: false,
    version: false,
    weight: false,
    storage: false,
    model: false
  });
  const [attributeValues, setAttributeValues] = useState({
    size: '',
    color: '',
    version: '',
    weight: '',
    storage: '',
    model: ''
  });

  // Specs helper local state
  const [newSpec, setNewSpec] = useState({ name: '', value: '', is_highlight: false });

  // Drag & drop file states
  const [isDragOver, setIsDragOver] = useState({ cover: false, gallery: false, video: false });

  // Preview helper state
  const [activePreviewImage, setActivePreviewImage] = useState('');
  const [selectedPreviewColor, setSelectedPreviewColor] = useState('');
  const [selectedPreviewVariant, setSelectedPreviewVariant] = useState(null);

  // Hydrate categories and suppliers
  useEffect(() => {
    const loadInitData = async () => {
      try {
        setLoading(true);
        const [cats, sups] = await Promise.all([
          adminService.getCategories(),
          adminService.getSuppliers()
        ]);
        setCategories(cats);
        setSuppliers(sups);

        // Edit Mode Data Fetching
        if (mode === 'edit' && productId) {
          const prodDetails = await adminService.getAllProducts();
          const match = prodDetails.find(p => String(p.product_id) === String(productId));
          if (!match) {
            setError('Product not found');
            return;
          }

          // Fetch full nested detail from backend
          const details = await getProduct(productId);

          // Map values
          const cleanMedia = {
            cover: details.media?.cover || details.image_url || '',
            coverAlt: details.media?.coverAlt || 'Product image',
            gallery: details.media?.gallery || [],
            galleryAlts: details.media?.galleryAlts || [],
            video: details.media?.video || '',
            videoAlt: details.media?.videoAlt || '',
            variantMedia: details.media?.variantMedia || []
          };

          setFormData({
            product_name: details.product_name || '',
            brand: details.brand || '',
            category: details.category_id || '',
            supplier_id: details.supplier_id || '',
            description: details.description || '',
            short_description: details.short_description || '',
            slug: details.slug || '',
            selling_price: details.selling_price || '',
            cost_price: details.cost_price || '',
            mrp: details.mrp || '',
            badge: details.badge || '',
            product_status: details.product_status || 'draft',
            media: cleanMedia,
            variants: details.variants || [],
            specifications: details.specifications || [],
            warranty: details.warranty || {
              warranty_period: '1 Year',
              warranty_type: 'Manufacturer',
              replacement_days: 7,
              return_days: 10,
              description: ''
            },
            shipping: details.shipping || {
              weight: '',
              length: '',
              width: '',
              height: '',
              shipping_class: 'Standard',
              cod_available: 1,
              free_shipping: 0
            }
          });

          // Check if there are active user-defined variants
          const nonDefaultVariants = (details.variants || []).filter(v => v.color !== 'Default' || v.size);
          if (nonDefaultVariants.length > 0) {
            setHasVariants(true);
            const activeAttrs = { size: false, color: false, version: false, weight: false, storage: false, model: false };
            nonDefaultVariants.forEach(v => {
              if (v.size) activeAttrs.size = true;
              if (v.color && v.color !== 'Default') activeAttrs.color = true;
              if (v.version) activeAttrs.version = true;
              if (v.weight) activeAttrs.weight = true;
              if (v.storage) activeAttrs.storage = true;
              if (v.model) activeAttrs.model = true;
            });
            setVariantAttributes(activeAttrs);
          }
        } else {
          // Pre-populate category/supplier dropdowns in create mode
          if (cats.length > 0) {
            setFormData(prev => ({ ...prev, category: cats[0].category_id }));
          }
          if (sups.length > 0) {
            setFormData(prev => ({ ...prev, supplier_id: sups[0].supplier_id }));
          }
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to fetch form parameters'));
        showToast('error', 'Error initializing product builder');
      } finally {
        setLoading(false);
      }
    };
    loadInitData();
  }, [mode, productId]);

  // Specification template suggestions
  useEffect(() => {
    if (mode === 'edit') return;
    const selected = categories.find(c => String(c.category_id) === String(formData.category));
    if (!selected) return;

    const catName = selected.category_name.toLowerCase();
    let defaults = [];
    if (catName.includes('electr')) {
      defaults = [
        { name: 'Processor', value: '' },
        { name: 'RAM', value: '' },
        { name: 'Battery', value: '' },
        { name: 'Display', value: '' }
      ];
    } else if (catName.includes('cloth') || catName.includes('apparel')) {
      defaults = [
        { name: 'Material', value: '' },
        { name: 'Fit', value: '' },
        { name: 'Pattern', value: '' }
      ];
    } else if (catName.includes('food') || catName.includes('grocer')) {
      defaults = [
        { name: 'Weight', value: '' },
        { name: 'Brand', value: '' },
        { name: 'Shelf Life', value: '' }
      ];
    } else if (catName.includes('home') || catName.includes('kitchen')) {
      defaults = [
        { name: 'Material', value: '' },
        { name: 'Dimensions', value: '' },
        { name: 'Warranty', value: '' }
      ];
    } else {
      defaults = [
        { name: 'Material', value: '' },
        { name: 'Manufacturer', value: '' }
      ];
    }

    setFormData(prev => ({ ...prev, specifications: defaults }));
  }, [formData.category, categories, mode]);

  // Set active preview image on load or media update
  useEffect(() => {
    if (formData.media?.cover) {
      setActivePreviewImage(formData.media.cover);
    }
  }, [formData.media]);

  // Set default preview color and variant on preview step
  useEffect(() => {
    if (activeStep === 8 && formData.variants?.length > 0) {
      const colors = [...new Set(formData.variants.map(v => v.color).filter(Boolean))];
      if (colors.length > 0) {
        setSelectedPreviewColor(colors[0]);
      }
      setSelectedPreviewVariant(formData.variants[0]);
    }
  }, [activeStep, formData.variants]);

  // Update variant media when preview color changes
  useEffect(() => {
    if (selectedPreviewColor && formData.media?.variantMedia?.length > 0) {
      const matched = formData.media.variantMedia.find(vm => vm.color === selectedPreviewColor);
      if (matched?.file_path) {
        setActivePreviewImage(matched.file_path);
      }
    }
  }, [selectedPreviewColor, formData.media]);

  // General field handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubObjectChange = (section, name, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [name]: value
      }
    }));
  };

  // Base64 file uploader
  const handleFileUpload = async (e, type, index = null) => {
    if (e.preventDefault) e.preventDefault();
    let file = null;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if (e.target && e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const sizeMB = file.size / (1024 * 1024);

    // Validate size and extensions
    if (type === 'video') {
      if (ext !== 'mp4') {
        showToast('error', 'Only MP4 videos are supported');
        return;
      }
      if (sizeMB > 50) {
        showToast('error', `Video exceeds maximum size of 50MB (Current: ${sizeMB.toFixed(1)}MB)`);
        return;
      }
    } else {
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        showToast('error', 'Only JPG, PNG, and WEBP image formats are supported');
        return;
      }
      if (sizeMB > 5) {
        showToast('error', `Image exceeds maximum size of 5MB (Current: ${sizeMB.toFixed(1)}MB)`);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        showToast('info', 'Uploading file...');
        const res = await adminService.uploadFile(file.name, base64Data);
        
        // Update paths
        if (type === 'cover') {
          handleSubObjectChange('media', 'cover', res.fileUrl);
        } else if (type === 'gallery') {
          setFormData(prev => {
            const list = [...prev.media.gallery];
            const alts = [...prev.media.galleryAlts];
            if (index !== null) {
              list[index] = res.fileUrl;
            } else {
              list.push(res.fileUrl);
              alts.push('Gallery image');
            }
            return {
              ...prev,
              media: { ...prev.media, gallery: list, galleryAlts: alts }
            };
          });
        } else if (type === 'video') {
          handleSubObjectChange('media', 'video', res.fileUrl);
        } else if (type === 'variant' && index !== null) {
          setFormData(prev => {
            const list = [...prev.media.variantMedia];
            list[index].file_path = res.fileUrl;
            return {
              ...prev,
              media: { ...prev.media, variantMedia: list }
            };
          });
        }
        showToast('success', 'File uploaded successfully');
      } catch (err) {
        showToast('error', 'File upload failed');
      }
    };
    reader.readAsDataURL(file);
  };

  // Cartesian Variant Generator
  const generateVariants = () => {
    const activeAttrs = Object.keys(variantAttributes).filter(key => variantAttributes[key]);
    if (activeAttrs.length === 0) {
      showToast('warning', 'Please check at least one attribute (e.g. Size, Color) to generate combinations.');
      return;
    }

    const attrValuesLists = {};
    for (const attr of activeAttrs) {
      const valueString = attributeValues[attr] || '';
      const cleanArray = valueString.split(',').map(s => s.trim()).filter(Boolean);
      if (cleanArray.length === 0) {
        showToast('error', `Please fill values for the attribute: ${attr}`);
        return;
      }
      attrValuesLists[attr] = cleanArray;
    }

    // Helper Cartesian
    const cartesian = (arrays) => {
      return arrays.reduce((acc, curr) => {
        return acc.flatMap(d => curr.map(e => [d, e].flat()));
      }, [[]]);
    };

    const keys = Object.keys(attrValuesLists);
    const valuesList = Object.values(attrValuesLists);
    const combinations = cartesian(valuesList);

    const categoryName = categories.find(c => String(c.category_id) === String(formData.category))?.category_name || 'CAT';
    const catCode = categoryName.slice(0, 3).toUpperCase();
    const nameCode = formData.product_name.slice(0, 3).toUpperCase() || 'PROD';

    const generated = combinations.map((combo, idx) => {
      const varObj = {
        variant_id: null,
        size: null,
        color: 'Default',
        version: null,
        weight: null,
        storage: null,
        model: null,
        sku: '',
        selling_price: formData.selling_price || '',
        cost_price: formData.cost_price || '',
        mrp: formData.mrp || formData.selling_price || '',
        stock: 0,
        reorder_level: 10,
        barcode: ''
      };

      keys.forEach((key, index) => {
        const val = Array.isArray(combo) ? combo[index] : combo;
        varObj[key] = val;
      });

      // Format SKU
      const sizeTag = (varObj.size || 'UNI').substring(0, 3).toUpperCase();
      const colorTag = (varObj.color || 'DFT').substring(0, 3).toUpperCase();
      const salt = Math.random().toString(36).substring(2, 6).toUpperCase();
      varObj.sku = `${catCode}-${nameCode}-${sizeTag}-${colorTag}-${salt}`;

      return varObj;
    });

    setFormData(prev => ({
      ...prev,
      variants: generated
    }));

    // Auto seed variant-specific media maps if color is an attribute
    if (variantAttributes.color) {
      const distinctColors = [...new Set(generated.map(g => g.color))];
      const newVarMedia = distinctColors.map(col => ({
        color: col,
        file_path: '',
        alt_text: `${col} variant image`
      }));
      setFormData(prev => ({
        ...prev,
        media: { ...prev.media, variantMedia: newVarMedia }
      }));
    }

    showToast('success', `Automatically generated ${generated.length} variant combinations!`);
  };

  // Specifications builder
  const handleAddSpec = () => {
    if (!newSpec.name || !newSpec.value) return;
    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { ...newSpec }]
    }));
    setNewSpec({ name: '', value: '', is_highlight: false });
  };

  const handleRemoveSpec = (idx) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== idx)
    }));
  };

  const handleSpecValueChange = (idx, val) => {
    setFormData(prev => {
      const copy = [...prev.specifications];
      copy[idx].value = val;
      return { ...prev, specifications: copy };
    });
  };

  // Step Nav validation
  const validateAndNext = () => {
    if (activeStep === 1) {
      if (!formData.product_name || !formData.category || !formData.supplier_id || !formData.description) {
        showToast('error', 'Please fill all required basic fields (*)');
        return;
      }
      if (!hasVariants) {
        if (!formData.cost_price || !formData.selling_price || !formData.mrp) {
          showToast('error', 'Please specify Cost Price, Selling Price, and MRP');
          return;
        }
        if (parseFloat(formData.selling_price) < parseFloat(formData.cost_price)) {
          showToast('error', 'Selling price must be greater than or equal to cost price');
          return;
        }
        if (parseFloat(formData.mrp) < parseFloat(formData.selling_price)) {
          showToast('error', 'MRP must be greater than or equal to selling price');
          return;
        }
      }
    }
    if (activeStep === 2) {
      if (!formData.media.cover) {
        showToast('error', 'Please upload a Cover Image');
        return;
      }
      if (!formData.media.coverAlt) {
        showToast('error', 'Alt text for Cover Image is required for SEO');
        return;
      }
    }
    if (activeStep === 3 && hasVariants) {
      if (formData.variants.length === 0) {
        showToast('error', 'No variants generated. Either build variants or uncheck the multiple variants setting.');
        return;
      }
      // Check variant prices
      for (const v of formData.variants) {
        if (!v.selling_price || !v.cost_price || !v.mrp) {
          showToast('error', 'Please specify selling price, cost price, and MRP for all generated variants');
          return;
        }
        if (parseFloat(v.selling_price) < parseFloat(v.cost_price)) {
          showToast('error', 'Selling price must be greater than or equal to cost price');
          return;
        }
        if (parseFloat(v.mrp) < parseFloat(v.selling_price)) {
          showToast('error', 'MRP must be greater than or equal to selling price');
          return;
        }
      }
    }
    setActiveStep(prev => Math.min(prev + 1, 8));
  };

  // Submit Handler
  const handleSave = async (status = 'draft') => {
    setSubmitting(true);
    try {
      const finalPayload = {
        ...formData,
        product_status: status
      };

      if (mode === 'create') {
        await addProduct(finalPayload);
        showToast('success', `Product ${status === 'active' ? 'published' : 'saved as draft'} successfully!`);
      } else {
        await adminService.updateProduct(productId, finalPayload);
        showToast('success', `Product updated successfully!`);
      }
      navigate(ROUTES.ADMIN_PRODUCTS);
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to save product'));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <Link to={ROUTES.ADMIN_PRODUCTS} className="ap-btn ap-btn--primary" style={{ marginTop: '12px' }}>
          Back to Catalog
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ap-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="product-wizard">
      {/* Wizard Header Banner */}
      <header className="product-wizard__header">
        <Link to={ROUTES.ADMIN_PRODUCTS} className="ap-btn ap-btn--ghost">
          <ArrowLeft size={16} />
          <span>Back to Catalog</span>
        </Link>
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="ap-title">{mode === 'create' ? 'Product Creation Studio' : 'Edit Product Details'}</h1>
            <p className="ap-subtitle">Design, customize, and configure e-commerce item details</p>
          </div>
          <div className="product-wizard__status-label">
            <span>Status: </span>
            <span className={`ap-badge ${formData.product_status === 'active' ? 'ap-badge--green' : 'ap-badge--yellow'}`}>
              {formData.product_status.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid: Left Side Navigation, Right Side content container */}
      <div className="product-wizard__grid">
        {/* Left Side steps navigation panel */}
        <aside className="product-wizard__side">
          <nav className="product-wizard__nav">
            {STEPS.map((step) => {
              const isCompleted = step.id < activeStep;
              const isActive = step.id === activeStep;
              return (
                <button
                  key={step.id}
                  className={`product-wizard__step-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => {
                    // Prevent skipping ahead without basic information
                    if (step.id > 1 && (!formData.product_name || !formData.category)) {
                      showToast('error', 'Please complete Step 1 (Basic Information) first');
                      return;
                    }
                    setActiveStep(step.id);
                  }}
                >
                  <span className="step-num">
                    {isCompleted ? <CheckCircle size={16} /> : step.id}
                  </span>
                  <span className="step-title">{step.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Side Step Form Components */}
        <main className="product-wizard__main ap-card">
          {/* STEP 1: Basic Information */}
          {activeStep === 1 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 1 — Basic Information</h2>
              <div className="create-product__form">
                <div className="ap-field">
                  <label className="ap-label">Product Name *</label>
                  <input
                    type="text"
                    name="product_name"
                    className="ap-input"
                    placeholder="e.g. iPhone 17 Pro Max"
                    value={formData.product_name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="create-product__row">
                  <div className="ap-field">
                    <label className="ap-label">Brand</label>
                    <input
                      type="text"
                      name="brand"
                      className="ap-input"
                      placeholder="e.g. Apple"
                      value={formData.brand}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Category *</label>
                    <select
                      name="category"
                      className="ap-select"
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      {categories.map(c => (
                        <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="create-product__row">
                  <div className="ap-field">
                    <label className="ap-label">Supplier *</label>
                    <select
                      name="supplier_id"
                      className="ap-select"
                      value={formData.supplier_id}
                      onChange={handleInputChange}
                    >
                      {suppliers.map(s => (
                        <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Custom Slug (Optional)</label>
                    <input
                      type="text"
                      name="slug"
                      className="ap-input"
                      placeholder="e.g. iphone-17-pro-max (Auto-generated if empty)"
                      value={formData.slug}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="ap-field">
                  <label className="ap-label">Short Description *</label>
                  <input
                    type="text"
                    name="short_description"
                    className="ap-input"
                    placeholder="Provide a quick 1-sentence product summary"
                    value={formData.short_description}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="ap-field">
                  <label className="ap-label">Full Description *</label>
                  <textarea
                    name="description"
                    className="ap-input"
                    rows={6}
                    placeholder="Provide full technical, usage, and material description"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                {!hasVariants && (
                  <>
                    <div className="create-product__row">
                      <div className="ap-field">
                        <label className="ap-label">Base Cost Price (₹) *</label>
                        <input
                          type="number"
                          name="cost_price"
                          className="ap-input"
                          placeholder="0.00"
                          value={formData.cost_price}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="ap-field">
                        <label className="ap-label">Base Selling Price (₹) *</label>
                        <input
                          type="number"
                          name="selling_price"
                          className="ap-input"
                          placeholder="0.00"
                          value={formData.selling_price}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="ap-field">
                        <label className="ap-label">Base MRP (₹) *</label>
                        <input
                          type="number"
                          name="mrp"
                          className="ap-input"
                          placeholder="0.00"
                          value={formData.mrp}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {/* Profit and Margin indicators */}
                    {(() => {
                      const cost = parseFloat(formData.cost_price || 0);
                      const selling = parseFloat(formData.selling_price || 0);
                      if (selling > 0 && cost > 0) {
                        const profit = selling - cost;
                        const margin = (profit / selling) * 100;
                        const isPositive = profit >= 0;
                        return (
                          <div className={`pricing-analytics-alert ${isPositive ? 'positive' : 'negative'}`}>
                            <strong>Pricing Analysis:</strong> Est. Profit: ₹{profit.toFixed(2)} | Margin: {margin.toFixed(2)}%
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}

                {/* Badge selector is base detail, so always available */}
                <div className="ap-field" style={{ marginTop: '16px' }}>
                  <label className="ap-label">Product Badge Indicator</label>
                  <select
                    name="badge"
                    className="ap-input"
                    value={formData.badge}
                    onChange={handleInputChange}
                  >
                    <option value="">None (No Badge)</option>
                    <option value="BESTSELLER">Bestseller</option>
                    <option value="NEW">New Arrival</option>
                    <option value="LIMITED STOCK">Limited Stock</option>
                    <option value="SALE">On Sale</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Media Upload */}
          {activeStep === 2 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 2 — Media Upload</h2>
              
              {/* Cover Photo */}
              <div className="media-section">
                <h3>Cover Image *</h3>
                <p className="media-desc">Primary photo seen by customers on cards and details. (Max: 5MB. JPG/PNG/WEBP)</p>
                <div className="media-upload-row">
                  <div 
                    className={`media-preview-box ${isDragOver.cover ? 'media-preview-box--drag-over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, cover: true }));
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, cover: false }));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, cover: false }));
                      handleFileUpload(e, 'cover');
                    }}
                  >
                    {formData.media.cover ? (
                      <img src={formData.media.cover.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${formData.media.cover}` : formData.media.cover} alt="Cover Preview" />
                    ) : (
                      <div className="media-placeholder">
                        <ImageIcon size={32} />
                        <span>No image (or drop here)</span>
                      </div>
                    )}
                  </div>
                  <div className="media-upload-details">
                    <label className="file-upload-btn">
                      <Upload size={14} />
                      <span>Upload Cover Image</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} />
                    </label>
                    <div className="ap-field" style={{ marginTop: '12px' }}>
                      <label className="ap-label">SEO Alternative Text *</label>
                      <input
                        type="text"
                        placeholder="Describe the cover image (for SEO and accessibility)"
                        className="ap-input"
                        value={formData.media.coverAlt}
                        onChange={(e) => handleSubObjectChange('media', 'coverAlt', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gallery Photos */}
              <div className="media-section" style={{ marginTop: '24px' }}>
                <h3>Gallery Images</h3>
                <p className="media-desc">Add up to 9 secondary images. (Max: 5MB each)</p>
                <div className="gallery-grid">
                  {formData.media.gallery.map((img, idx) => (
                    <div key={idx} className="gallery-item-card">
                      <img src={img.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${img}` : img} alt={`Gallery ${idx}`} />
                      <div className="gallery-item-actions">
                        <input
                          type="text"
                          className="ap-input gallery-alt-input"
                          placeholder="Image alt text"
                          value={formData.media.galleryAlts[idx] || ''}
                          onChange={(e) => {
                            const list = [...formData.media.galleryAlts];
                            list[idx] = e.target.value;
                            handleSubObjectChange('media', 'galleryAlts', list);
                          }}
                        />
                        <button
                          type="button"
                          className="trash-btn"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              media: {
                                ...prev.media,
                                gallery: prev.media.gallery.filter((_, i) => i !== idx),
                                galleryAlts: prev.media.galleryAlts.filter((_, i) => i !== idx)
                              }
                            }));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formData.media.gallery.length < 9 && (
                    <label 
                      className={`gallery-add-card ${isDragOver.gallery ? 'gallery-add-card--drag-over' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(prev => ({ ...prev, gallery: true }));
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragOver(prev => ({ ...prev, gallery: false }));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(prev => ({ ...prev, gallery: false }));
                        handleFileUpload(e, 'gallery');
                      }}
                    >
                      <Plus size={24} />
                      <span>Add Image (or drop)</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'gallery')} />
                    </label>
                  )}
                </div>
              </div>

              {/* Product Video */}
              <div className="media-section" style={{ marginTop: '24px' }}>
                <h3>Product Video</h3>
                <p className="media-desc">Add one highlight video. (Max: 50MB. MP4 format)</p>
                <div className="media-upload-row">
                  <div 
                    className={`media-preview-box ${isDragOver.video ? 'media-preview-box--drag-over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, video: true }));
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, video: false }));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, video: false }));
                      handleFileUpload(e, 'video');
                    }}
                  >
                    {formData.media.video ? (
                      <video src={formData.media.video.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${formData.media.video}` : formData.media.video} controls width="100%" />
                    ) : (
                      <div className="media-placeholder">
                        <VideoIcon size={32} />
                        <span>No video (or drop here)</span>
                      </div>
                    )}
                  </div>
                  <div className="media-upload-details">
                    <label className="file-upload-btn">
                      <Upload size={14} />
                      <span>Upload Video File</span>
                      <input type="file" accept="video/mp4" onChange={(e) => handleFileUpload(e, 'video')} />
                    </label>
                    {formData.media.video && (
                      <button
                        type="button"
                        className="ap-btn ap-btn--ghost text-danger"
                        style={{ marginTop: '12px' }}
                        onClick={() => handleSubObjectChange('media', 'video', '')}
                      >
                        <Trash2 size={14} />
                        <span>Remove Video</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Variant Builder */}
          {activeStep === 3 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 3 — Variant Builder</h2>
              
              <div className="variant-enable-box">
                <label className="checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => setHasVariants(e.target.checked)}
                  />
                  <span className="checkbox-label" style={{ fontWeight: '600', fontSize: '15px' }}>
                    This product possesses multiple variants (sizes, colors, versions, weights)
                  </span>
                </label>
              </div>

              {hasVariants ? (
                <div className="variant-wizard-area">
                  {/* Select Attributes */}
                  <div className="variant-attr-selector">
                    <h4>Select active attributes to build combinations:</h4>
                    <div className="attr-checkboxes-row">
                      {Object.keys(variantAttributes).map(attr => (
                        <label key={attr} className="checkbox-wrap">
                          <input
                            type="checkbox"
                            checked={variantAttributes[attr]}
                            onChange={(e) => setVariantAttributes(prev => ({ ...prev, [attr]: e.target.checked }))}
                          />
                          <span className="checkbox-label" style={{ textTransform: 'capitalize' }}>{attr}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Input Attribute values */}
                  <div className="variant-values-inputs" style={{ marginTop: '20px' }}>
                    <h4>Enter comma-separated values (e.g. Black, Blue):</h4>
                    <div className="attr-values-grid">
                      {Object.keys(variantAttributes).map(attr => {
                        if (!variantAttributes[attr]) return null;
                        return (
                          <div key={attr} className="ap-field">
                            <label className="ap-label" style={{ textTransform: 'capitalize' }}>{attr} Values *</label>
                            <input
                              type="text"
                              className="ap-input"
                              placeholder={`e.g. M, L or Red, Green`}
                              value={attributeValues[attr]}
                              onChange={(e) => setAttributeValues(prev => ({ ...prev, [attr]: e.target.value }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="ap-btn ap-btn--secondary"
                      style={{ marginTop: '16px' }}
                      onClick={generateVariants}
                    >
                      <Sparkles size={14} />
                      <span>Generate Combinations</span>
                    </button>
                  </div>

                  {/* Inline list of variants */}
                  {formData.variants.length > 0 && (
                    <div className="generated-variants-list" style={{ marginTop: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4>Generated Variant Options ({formData.variants.length})</h4>
                        <button
                          type="button"
                          className="ap-btn ap-btn--ghost text-danger"
                          onClick={() => setFormData(prev => ({ ...prev, variants: [] }))}
                        >
                          <Trash2 size={13} />
                          <span>Clear All</span>
                        </button>
                      </div>
                      
                      <div className="ap-table-wrap">
                        <table className="ap-table variant-table">
                          <thead>
                            <tr>
                              <th>Variant Description</th>
                              <th>SKU *</th>
                              <th>Cost Price *</th>
                              <th>Selling Price *</th>
                              <th>MRP *</th>
                              <th>Margin / Profit</th>
                              <th>Initial Stock</th>
                              <th>Barcode</th>
                              <th>Remove</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.variants.map((v, idx) => {
                              const desc = [v.size, v.color, v.version, v.weight, v.storage, v.model].filter(Boolean).join(' / ');
                              return (
                                <tr key={idx}>
                                  <td style={{ fontWeight: '600' }}>{desc || 'Default'}</td>
                                  <td>
                                    <input
                                      type="text"
                                      className="ap-input table-cell-input"
                                      value={v.sku}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].sku = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="ap-input table-cell-input"
                                      value={v.cost_price}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].cost_price = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="ap-input table-cell-input"
                                      value={v.selling_price}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].selling_price = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="ap-input table-cell-input"
                                      value={v.mrp}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].mrp = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    {(() => {
                                      const cost = parseFloat(v.cost_price || 0);
                                      const selling = parseFloat(v.selling_price || 0);
                                      if (selling > 0 && cost > 0) {
                                        const profit = selling - cost;
                                        const margin = (profit / selling) * 100;
                                        return (
                                          <span style={{ fontSize: '0.78rem', color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                            {margin.toFixed(0)}% (₹{profit.toFixed(0)})
                                          </span>
                                        );
                                      }
                                      return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
                                    })()}
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="ap-input table-cell-input"
                                      value={v.stock}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].stock = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      className="ap-input table-cell-input"
                                      value={v.barcode}
                                      onChange={(e) => {
                                        const list = [...formData.variants];
                                        list[idx].barcode = e.target.value;
                                        setFormData(prev => ({ ...prev, variants: list }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="trash-btn"
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          variants: prev.variants.filter((_, i) => i !== idx)
                                        }));
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Variant Specific Images section */}
                      {formData.media.variantMedia?.length > 0 && (
                        <div className="variant-images-builder" style={{ marginTop: '24px' }}>
                          <h4>Upload Variant Specific Cover Images:</h4>
                          <p className="media-desc">These images override the main cover photo when this variant is selected by customers.</p>
                          <div className="variant-images-grid">
                            {formData.media.variantMedia.map((vm, vidx) => (
                              <div key={vidx} className="variant-image-item">
                                <span className="variant-label-tag">{vm.color}</span>
                                <div className="media-preview-box min-preview">
                                  {vm.file_path ? (
                                    <img src={vm.file_path.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${vm.file_path}` : vm.file_path} alt={vm.color} />
                                  ) : (
                                    <div className="media-placeholder">
                                      <ImageIcon size={18} />
                                    </div>
                                  )}
                                </div>
                                <label className="file-upload-btn compact-upload-btn">
                                  <Upload size={12} />
                                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'variant', vidx)} />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="ap-card ap-empty" style={{ marginBlock: '20px', borderColor: 'var(--color-border-subtle)' }}>
                  <HelpCircle size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }} />
                  <p style={{ fontWeight: '600' }}>Single Variant Mode Activated</p>
                  <p className="ap-empty__desc">Default SKU, base price, and inventory details will be configured in Step 4.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Inventory Settings */}
          {activeStep === 4 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 4 — Inventory Settings</h2>
              
              {!hasVariants ? (
                <div className="create-product__form">
                  <div className="create-product__row">
                    <div className="ap-field">
                      <label className="ap-label">Initial Available Stock *</label>
                      <input
                        type="number"
                        className="ap-input"
                        placeholder="e.g. 100"
                        value={formData.variants[0]?.stock ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => {
                            const list = [...prev.variants];
                            if (list.length === 0) {
                              list.push({ is_default: 1, stock: val, reorder_level: 10, color: 'Default' });
                            } else {
                              list[0].stock = val;
                            }
                            return { ...prev, variants: list };
                          });
                        }}
                      />
                    </div>
                    
                    <div className="ap-field">
                      <label className="ap-label">Reorder Level *</label>
                      <input
                        type="number"
                        className="ap-input"
                        placeholder="Alert threshold when stock drops below this"
                        value={formData.variants[0]?.reorder_level ?? 10}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => {
                            const list = [...prev.variants];
                            if (list.length === 0) {
                              list.push({ is_default: 1, stock: 0, reorder_level: val, color: 'Default' });
                            } else {
                              list[0].reorder_level = val;
                            }
                            return { ...prev, variants: list };
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="create-product__row">
                    <div className="ap-field">
                      <label className="ap-label">Supplier SKU</label>
                      <input
                        type="text"
                        className="ap-input"
                        placeholder="Supplier's internal tracking ID"
                        value={formData.variants[0]?.sku ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => {
                            const list = [...prev.variants];
                            if (list.length === 0) {
                              list.push({ is_default: 1, sku: val, color: 'Default' });
                            } else {
                              list[0].sku = val;
                            }
                            return { ...prev, variants: list };
                          });
                        }}
                      />
                    </div>

                    <div className="ap-field">
                      <label className="ap-label">Barcode / GTIN</label>
                      <input
                        type="text"
                        className="ap-input"
                        placeholder="EAN, UPC, ISBN, or barcode string"
                        value={formData.variants[0]?.barcode ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => {
                            const list = [...prev.variants];
                            if (list.length === 0) {
                              list.push({ is_default: 1, barcode: val, color: 'Default' });
                            } else {
                              list[0].barcode = val;
                            }
                            return { ...prev, variants: list };
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="variant-inventory-adjust">
                  <h4>Configure Warning Reorder Levels for Variant Stock:</h4>
                  <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Variant Name</th>
                          <th>SKU</th>
                          <th>Available Stock</th>
                          <th>Reorder Level *</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.variants.map((v, idx) => {
                          const desc = [v.size, v.color, v.version, v.weight, v.storage, v.model].filter(Boolean).join(' / ');
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{desc || 'Default'}</td>
                              <td>{v.sku}</td>
                              <td>{v.stock} units</td>
                              <td>
                                <input
                                  type="number"
                                  className="ap-input table-cell-input"
                                  value={v.reorder_level}
                                  onChange={(e) => {
                                    const list = [...formData.variants];
                                    list[idx].reorder_level = e.target.value;
                                    setFormData(prev => ({ ...prev, variants: list }));
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Specifications */}
          {activeStep === 5 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 5 — Specifications</h2>
              <p className="media-desc" style={{ marginBottom: '16px' }}>Add dynamic key-value properties describing the product. Pre-filled templates are suggested based on your category selection.</p>

              {/* Dynamic Builder */}
              <div className="specifications-builder-box">
                <div className="spec-inputs-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Key (e.g. Battery)"
                    className="ap-input"
                    value={newSpec.name}
                    onChange={(e) => setNewSpec(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 5000mAh)"
                    className="ap-input"
                    value={newSpec.value}
                    onChange={(e) => setNewSpec(prev => ({ ...prev, value: e.target.value }))}
                  />
                  <label className="checkbox-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={newSpec.is_highlight}
                      onChange={(e) => setNewSpec(prev => ({ ...prev, is_highlight: e.target.checked }))}
                    />
                    <span>Highlight</span>
                  </label>
                  <button
                    type="button"
                    className="ap-btn ap-btn--secondary"
                    onClick={handleAddSpec}
                  >
                    <Plus size={14} />
                    <span>Add spec</span>
                  </button>
                </div>

                <div className="specs-list" style={{ marginTop: '24px' }}>
                  <h4>Active Specifications ({formData.specifications.length})</h4>
                  {formData.specifications.length === 0 ? (
                    <p className="ap-subtitle">No specifications added yet. Fill inputs above.</p>
                  ) : (
                    <div className="specs-items-grid">
                      {formData.specifications.map((spec, idx) => (
                        <div key={idx} className="spec-item-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="spec-name-label" style={{ minWidth: '100px', fontWeight: '600' }}>{spec.name}</span>
                          <input
                            type="text"
                            className="ap-input spec-val-input"
                            value={spec.value}
                            placeholder="Enter value"
                            onChange={(e) => handleSpecValueChange(idx, e.target.value)}
                          />
                          <label className="checkbox-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={!!spec.is_highlight}
                              onChange={(e) => {
                                setFormData(prev => {
                                  const copy = [...prev.specifications];
                                  copy[idx].is_highlight = e.target.checked ? 1 : 0;
                                  return { ...prev, specifications: copy };
                                });
                              }}
                            />
                            <span>Highlight</span>
                          </label>
                          <button
                            type="button"
                            className="trash-btn"
                            onClick={() => handleRemoveSpec(idx)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Shipping Details */}
          {activeStep === 6 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 6 — Shipping Details</h2>
              <div className="create-product__form">
                <div className="create-product__row">
                  <div className="ap-field">
                    <label className="ap-label">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="ap-input"
                      placeholder="e.g. 0.45"
                      value={formData.shipping.weight}
                      onChange={(e) => handleSubObjectChange('shipping', 'weight', e.target.value)}
                    />
                  </div>
                  
                  <div className="ap-field">
                    <label className="ap-label">Shipping Class *</label>
                    <select
                      className="ap-select"
                      value={formData.shipping.shipping_class}
                      onChange={(e) => handleSubObjectChange('shipping', 'shipping_class', e.target.value)}
                    >
                      <option value="Standard">Standard</option>
                      <option value="Fragile">Fragile</option>
                      <option value="Heavy">Heavy</option>
                      <option value="Oversized">Oversized</option>
                    </select>
                  </div>
                </div>

                <div className="ap-field">
                  <label className="ap-label">Dimensions (cm) — L × W × H</label>
                  <div className="dimensions-row">
                    <input
                      type="number"
                      placeholder="Length"
                      className="ap-input"
                      value={formData.shipping.length}
                      onChange={(e) => handleSubObjectChange('shipping', 'length', e.target.value)}
                    />
                    <span>×</span>
                    <input
                      type="number"
                      placeholder="Width"
                      className="ap-input"
                      value={formData.shipping.width}
                      onChange={(e) => handleSubObjectChange('shipping', 'width', e.target.value)}
                    />
                    <span>×</span>
                    <input
                      type="number"
                      placeholder="Height"
                      className="ap-input"
                      value={formData.shipping.height}
                      onChange={(e) => handleSubObjectChange('shipping', 'height', e.target.value)}
                    />
                  </div>
                </div>

                <div className="create-product__row" style={{ marginTop: '12px' }}>
                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={formData.shipping.cod_available === 1}
                      onChange={(e) => handleSubObjectChange('shipping', 'cod_available', e.target.checked ? 1 : 0)}
                    />
                    <span className="checkbox-label">Cash on Delivery (COD) Available</span>
                  </label>

                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={formData.shipping.free_shipping === 1}
                      onChange={(e) => handleSubObjectChange('shipping', 'free_shipping', e.target.checked ? 1 : 0)}
                    />
                    <span className="checkbox-label">Eligible for Free Shipping</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Warranty & Returns */}
          {activeStep === 7 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 7 — Warranty & Returns</h2>
              <div className="create-product__form">
                <div className="create-product__row">
                  <div className="ap-field">
                    <label className="ap-label">Warranty Period</label>
                    <input
                      type="text"
                      className="ap-input"
                      placeholder="e.g. 1 Year, 6 Months"
                      value={formData.warranty.warranty_period}
                      onChange={(e) => handleSubObjectChange('warranty', 'warranty_period', e.target.value)}
                    />
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Warranty Type</label>
                    <select
                      className="ap-select"
                      value={formData.warranty.warranty_type}
                      onChange={(e) => handleSubObjectChange('warranty', 'warranty_type', e.target.value)}
                    >
                      <option value="Manufacturer">Manufacturer Warranty</option>
                      <option value="Seller">Seller Warranty</option>
                      <option value="None">No Warranty</option>
                    </select>
                  </div>
                </div>

                <div className="create-product__row">
                  <div className="ap-field">
                    <label className="ap-label">Replacement Window (Days)</label>
                    <input
                      type="number"
                      className="ap-input"
                      placeholder="e.g. 7"
                      value={formData.warranty.replacement_days}
                      onChange={(e) => handleSubObjectChange('warranty', 'replacement_days', e.target.value)}
                    />
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Return Window (Days)</label>
                    <input
                      type="number"
                      className="ap-input"
                      placeholder="e.g. 10"
                      value={formData.warranty.return_days}
                      onChange={(e) => handleSubObjectChange('warranty', 'return_days', e.target.value)}
                    />
                  </div>
                </div>

                <div className="ap-field">
                  <label className="ap-label">Warranty Description / Terms</label>
                  <textarea
                    className="ap-input"
                    rows={4}
                    placeholder="Details about warranty activation, what is covered and exclusions"
                    value={formData.warranty.description}
                    onChange={(e) => handleSubObjectChange('warranty', 'description', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Preview & Publish */}
          {activeStep === 8 && (
            <div className="wizard-step">
              <h2 className="wizard-step__title">Step 8 — Customer Experience Preview</h2>
              <p className="media-desc" style={{ marginBottom: '24px' }}>This is exactly how this item will be presented to customers on the store page.</p>

              {/* High Fidelity Detail Preview Mockup */}
              <div className="product-details-page-preview">
                <div className="product-details-page__main">
                  {/* Left Column: Image Panel */}
                  <div className="product-image-panel">
                    <div className="product-image-panel__main-wrap">
                      {activePreviewImage ? (
                        activePreviewImage.endsWith('.mp4') || activePreviewImage.includes('video') ? (
                          <video src={activePreviewImage.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${activePreviewImage}` : activePreviewImage} controls autoPlay muted width="100%" />
                        ) : (
                          <img src={activePreviewImage.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${activePreviewImage}` : activePreviewImage} alt={formData.product_name} />
                        )
                      ) : (
                        <div className="media-placeholder">No cover image uploaded</div>
                      )}
                    </div>

                    <div className="product-image-panel__thumbnails">
                      {formData.media.cover && (
                        <button
                          className={`thumb-btn ${activePreviewImage === formData.media.cover ? 'active' : ''}`}
                          onClick={() => setActivePreviewImage(formData.media.cover)}
                        >
                          <img src={formData.media.cover.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${formData.media.cover}` : formData.media.cover} alt="Thumb cover" />
                        </button>
                      )}
                      {formData.media.gallery.map((img, i) => (
                        <button
                          key={i}
                          className={`thumb-btn ${activePreviewImage === img ? 'active' : ''}`}
                          onClick={() => setActivePreviewImage(img)}
                        >
                          <img src={img.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL}${img}` : img} alt={`Thumb gallery ${i}`} />
                        </button>
                      ))}
                      {formData.media.video && (
                        <button
                          className={`thumb-btn video-thumb ${activePreviewImage === formData.media.video ? 'active' : ''}`}
                          onClick={() => setActivePreviewImage(formData.media.video)}
                        >
                          <VideoIcon size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Info Panel */}
                  <div className="product-info-panel">
                    <div className="product-info-panel__availability">
                      <span className="ap-badge ap-badge--green">In Stock</span>
                    </div>

                    <span className="prod-preview-brand">{formData.brand || 'ShopCart Brand'}</span>
                    <h1 className="product-info-panel__name">{formData.product_name || 'My New Product'}</h1>

                    <div className="product-info-panel__price-box">
                      <span className="product-info-panel__price">
                        ₹{selectedPreviewVariant ? Number(selectedPreviewVariant.selling_price).toLocaleString('en-IN') : Number(formData.selling_price || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <p className="prod-preview-short-desc">{formData.short_description || 'Brief description summary.'}</p>

                    {/* Variant selectors mock */}
                    {hasVariants && formData.variants.length > 0 && (
                      <div className="preview-variant-selectors">
                        {variantAttributes.color && (
                          <div className="selector-group">
                            <span className="selector-label">Color:</span>
                            <div className="color-pills">
                              {[...new Set(formData.variants.map(v => v.color))].map(color => (
                                <button
                                  key={color}
                                  className={`pill-btn ${selectedPreviewColor === color ? 'active' : ''}`}
                                  onClick={() => setSelectedPreviewColor(color)}
                                >
                                  {color}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {variantAttributes.size && (
                          <div className="selector-group" style={{ marginTop: '12px' }}>
                            <span className="selector-label">Size:</span>
                            <div className="size-pills">
                              {formData.variants.filter(v => !selectedPreviewColor || v.color === selectedPreviewColor).map(v => (
                                <button
                                  key={v.size}
                                  className={`pill-btn ${selectedPreviewVariant?.size === v.size ? 'active' : ''}`}
                                  onClick={() => setSelectedPreviewVariant(v)}
                                >
                                  {v.size}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Accordion specifications preview */}
                    <div className="preview-details-accordion">
                      <details open className="preview-details-item">
                        <summary>Key Specifications</summary>
                        <div className="preview-details-content">
                          <ul className="preview-specs-list">
                            {formData.specifications.map((spec, i) => (
                              <li key={i}>
                                <strong>{spec.name}: </strong>
                                <span>{spec.value || 'N/A'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>

                      <details className="preview-details-item">
                        <summary>Full Description</summary>
                        <div className="preview-details-content">
                          <p>{formData.description || 'Full specifications.'}</p>
                        </div>
                      </details>

                      <details className="preview-details-item">
                        <summary>Delivery & Shipping</summary>
                        <div className="preview-details-content">
                          <p>Shipping Class: <strong>{formData.shipping.shipping_class}</strong></p>
                          {formData.shipping.free_shipping === 1 && <p className="text-success">✓ Eligible for Free Shipping</p>}
                          {formData.shipping.cod_available === 1 && <p>✓ Cash on Delivery (COD) Available</p>}
                        </div>
                      </details>

                      <details className="preview-details-item">
                        <summary>Warranty & Returns</summary>
                        <div className="preview-details-content">
                          <p>Warranty: <strong>{formData.warranty.warranty_period} ({formData.warranty.warranty_type})</strong></p>
                          <p>Replacement: <strong>{formData.warranty.replacement_days} Days</strong></p>
                          <p>Returns: <strong>{formData.warranty.return_days} Days</strong></p>
                          {formData.warranty.description && <p style={{ fontSize: '12px', marginTop: '8px' }}>{formData.warranty.description}</p>}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step Actions Footer Row */}
          <footer className="product-wizard__footer">
            <button
              type="button"
              className="ap-btn ap-btn--ghost"
              disabled={activeStep === 1 || submitting}
              onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))}
            >
              <ArrowLeft size={14} />
              <span>Previous</span>
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              {activeStep < 8 ? (
                <button
                  type="button"
                  className="ap-btn ap-btn--primary"
                  onClick={validateAndNext}
                >
                  <span>Next Step</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="ap-btn ap-btn--secondary"
                    disabled={submitting}
                    onClick={() => handleSave('draft')}
                  >
                    {submitting ? <Spinner size={14} /> : <FileText size={14} />}
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    className="ap-btn ap-btn--primary"
                    disabled={submitting}
                    onClick={() => handleSave('active')}
                  >
                    {submitting ? <Spinner size={14} /> : <Save size={14} />}
                    <span>{mode === 'create' ? 'Publish Product' : 'Save Changes'}</span>
                  </button>
                </>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
