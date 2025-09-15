import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Upload, Search, Filter, FileSpreadsheet, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, BarChart3, Users, Package, FolderOpen } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Label } from '@/components/ui/label.jsx'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import './index.css'

function App() {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [allProductsData, setAllProductsData] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [percentageInput, setPercentageInput] = useState(25)
  const [applyScope, setApplyScope] = useState('selected')
  const [selectedProducts, setSelectedProducts] = useState(new Set())

  // Function to process a single Excel file
  const processExcelFile = (workbook, localName) => {
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Find the header row (assuming it's the 3rd row, index 2)
    const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 'A3:I3' })[0];

    // Extract data starting from the 4th row (index 3)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 'A4' });

    const columnMapping = {
      'Código': 'codigo',
      'Nombre': 'nombre',
      'Stock': 'stock',
      'Costo U.C.': 'costo_unitario',
      'Costo neto': 'costo_neto',
      'Precio de Venta': 'precio_venta',
      'Precio Sugerido': 'precio_sugerido_excel',
      'Porcentaje de Venta': 'porcentaje_venta_excel',
      'Familia': 'categoria'
    };

    const standardizedData = rawData.map(row => {
      const product = { local: localName };
      headerRow.forEach((header, index) => {
        const standardizedHeader = columnMapping[header] || header.toLowerCase().replace(/\s/g, '_');
        product[standardizedHeader] = row[index];
      });

      // Clean and convert data types
      product.codigo = String(product.codigo || '').trim();
      product.nombre = String(product.nombre || '').trim();
      product.stock = parseFloat(product.stock) || 0;
      product.costo_unitario = parseFloat(product.costo_unitario) || 0;
      product.costo_neto = parseFloat(product.costo_neto) || 0;
      product.precio_venta = parseFloat(product.precio_venta) || 0;
      product.categoria = String(product.categoria || '').trim();

      // Calculate current percentage of sale (gain/loss)
      if (product.costo_neto > 0) {
        product.porcentaje_ganancia_actual = ((product.precio_venta - product.costo_neto) / product.costo_neto) * 100;
      } else {
        product.porcentaje_ganancia_actual = 0;
      }

      // Initialize suggested price with current price
      product.precio_sugerido_calculado = product.precio_venta;

      return product;
    }).filter(p => p.codigo && p.nombre);

    return standardizedData;
  };

  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...allProductsData];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        String(p.codigo).toLowerCase().includes(query) ||
        String(p.nombre).toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.categoria === selectedCategory);
    }

    // Apply stock filter
    if (stockFilter === 'exclude_zero') {
      filtered = filtered.filter(p => p.stock !== 0);
    } else if (stockFilter === 'only_zero') {
      filtered = filtered.filter(p => p.stock === 0);
    } else if (stockFilter === 'only_negative') {
      filtered = filtered.filter(p => p.stock < 0);
    }

    // Group by product code to create comparison view
    const resultsDict = {};
    filtered.forEach(product => {
      const codigo = product.codigo;
      if (!resultsDict[codigo]) {
        resultsDict[codigo] = {
          codigo: codigo,
          nombre: product.nombre,
          categoria: product.categoria,
          locales: {},
          precio_sugerido_calculado: product.precio_sugerido_calculado,
          porcentaje_ganancia_actual: product.porcentaje_ganancia_actual
        };
      }
      resultsDict[codigo].locales[product.local] = {
        stock: product.stock,
        costo_unitario: product.costo_unitario,
        costo_neto: product.costo_neto,
        precio_venta: product.precio_venta,
      };
    });

    setProducts(Object.values(resultsDict));
  }, [allProductsData, searchQuery, selectedCategory, stockFilter]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Por favor selecciona al menos un archivo Excel');
      return;
    }

    setIsLoading(true);
    setUploadStatus(null);
    setAllProductsData([]);
    setProducts([]);
    setCategories([]);
    setSummary(null);
    setSelectedProducts(new Set());

    let combinedData = [];
    const processedLocals = new Set();

    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const localName = file.name.replace(/\.(xlsx|xls)$/i, '');
        const processedFileProducts = processExcelFile(workbook, localName);
        combinedData = combinedData.concat(processedFileProducts);
        processedLocals.add(localName);
      } catch (error) {
        setUploadStatus({ type: 'error', message: `Error procesando ${file.name}: ${error.message}` });
        setIsLoading(false);
        return;
      }
    }

    setAllProductsData(combinedData);

    const uniqueCategories = [...new Set(combinedData.map(p => p.categoria))].filter(Boolean).sort();
    const uniqueLocals = [...processedLocals].sort();

    setCategories(uniqueCategories);
    setSummary({
      total_products: combinedData.length,
      categories: uniqueCategories,
      locals: uniqueLocals,
      files_processed: files.length,
    });

    setUploadStatus({ type: 'success', message: 'Archivos procesados exitosamente' });
    setIsLoading(false);
  };

  const exportToExcel = () => {
    if (products.length === 0) {
      alert('No hay productos para exportar.');
      return;
    }

    const dataForExcel = [];
    const locals = summary ? summary.locals : [];

    let headerRow = ['Código', 'Nombre', 'Categoría'];
    locals.forEach(local => {
      headerRow.push(`${local} Stock`);
      headerRow.push(`${local} Costo`);
      headerRow.push(`${local} Venta`);
    });
    headerRow.push('Porcentaje Ganancia Actual');
    headerRow.push('Precio Sugerido Calculado');
    dataForExcel.push(headerRow);

    products.forEach(product => {
      let row = [
        product.codigo,
        product.nombre,
        product.categoria
      ];
      locals.forEach(local => {
        const localData = product.locales[local];
        if (localData) {
          row.push(localData.stock);
          row.push(localData.costo_neto);
          row.push(localData.precio_venta);
        } else {
          row.push('-', '-', '-');
        }
      });
      row.push(product.porcentaje_ganancia_actual?.toFixed(2) + '%');
      row.push(product.precio_sugerido_calculado?.toFixed(2));
      dataForExcel.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparacion Precios');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, 'comparacion_precios_mejorado.xlsx');
  };

  const applyPercentage = () => {
    const percentage = percentageInput;
    if (isNaN(percentage)) {
      alert('Por favor, ingresa un porcentaje válido.');
      return;
    }

    const updatedAllProductsData = allProductsData.map(p => {
      let shouldApply = false;
      if (applyScope === 'all') {
        shouldApply = true;
      } else if (applyScope === 'category' && selectedCategory !== 'all') {
        shouldApply = p.categoria === selectedCategory;
      } else if (applyScope === 'selected') {
        shouldApply = selectedProducts.has(p.codigo);
      }

      if (shouldApply && p.costo_neto > 0) {
        const newSuggestedPrice = p.costo_neto * (1 + percentage / 100);
        return { ...p, precio_sugerido_calculado: newSuggestedPrice };
      }
      return p;
    });

    setAllProductsData(updatedAllProductsData);
    applyFiltersAndSearch();
  };

  const toggleProductSelection = (codigo) => {
    setSelectedProducts(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(codigo)) {
        newSelected.delete(codigo);
      } else {
        newSelected.add(codigo);
      }
      return newSelected;
    });
  };

  const getGainIndicator = (percentage) => {
    if (percentage >= 30) return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 10) return { icon: Minus, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' };
  };

  const getStockIndicator = (stock) => {
    if (stock > 10) return { color: 'text-green-600', bg: 'bg-green-100' };
    if (stock > 0) return { color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { color: 'text-red-600', bg: 'bg-red-100' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Comparador de Precios
            </h1>
          </div>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Analiza y compara precios entre múltiples locales para optimizar tu estrategia de precios y maximizar ganancias
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Productos</p>
                    <p className="text-3xl font-bold">{summary.total_products}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Locales</p>
                    <p className="text-3xl font-bold">{summary.locals.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Categorías</p>
                    <p className="text-3xl font-bold">{summary.categories.length}</p>
                  </div>
                  <FolderOpen className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Archivos</p>
                    <p className="text-3xl font-bold">{summary.files_processed}</p>
                  </div>
                  <FileSpreadsheet className="h-8 w-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* File Upload Section */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              Cargar Archivos Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <Input
                  type="file"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mb-4 max-w-md mx-auto"
                />
                <p className="text-slate-600">
                  Arrastra y suelta archivos Excel aquí, o haz clic para seleccionar
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Formatos soportados: .xlsx, .xls
                </p>
              </div>
              
              {files.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="font-medium text-slate-800 mb-3">Archivos seleccionados:</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <Badge key={index} variant="secondary" className="px-3 py-1">
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleUpload} 
                disabled={isLoading || files.length === 0}
                className="w-full h-12 text-lg font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando archivos...
                  </div>
                ) : (
                  'Cargar y Procesar Archivos'
                )}
              </Button>

              {isLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Procesando archivos...</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              )}

              {uploadStatus && (
                <div className={`p-4 rounded-lg border ${
                  uploadStatus.type === 'success' 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {uploadStatus.type === 'success' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                    {uploadStatus.message}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters Section */}
        {summary && (
          <Card className="mb-8 border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Search className="h-5 w-5 text-green-600" />
                </div>
                Búsqueda y Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Buscar producto
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Código o nombre del producto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Categoría
                  </Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Filtro de stock
                  </Label>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Filtrar por stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los productos</SelectItem>
                      <SelectItem value="exclude_zero">Excluir stock = 0</SelectItem>
                      <SelectItem value="only_zero">Solo stock = 0</SelectItem>
                      <SelectItem value="only_negative">Solo stock negativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Percentage Application Section */}
        {summary && (
          <Card className="mb-8 border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                Aplicar Porcentaje de Venta Sugerido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-slate-700">
                      Porcentaje a aplicar: {percentageInput}%
                    </Label>
                    <div className="px-4">
                      <Slider
                        value={[percentageInput]}
                        onValueChange={(value) => setPercentageInput(value[0])}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-slate-700">
                      Ámbito de aplicación
                    </Label>
                    <RadioGroup value={applyScope} onValueChange={setApplyScope} className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50">
                        <RadioGroupItem value="selected" id="selected" />
                        <Label htmlFor="selected" className="flex-1 cursor-pointer">
                          Productos seleccionados ({selectedProducts.size})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50">
                        <RadioGroupItem value="category" id="category" />
                        <Label htmlFor="category" className="flex-1 cursor-pointer">
                          Categoría actual ({selectedCategory === 'all' ? 'Todas' : selectedCategory})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50">
                        <RadioGroupItem value="all" id="all" />
                        <Label htmlFor="all" className="flex-1 cursor-pointer">
                          Todos los productos cargados
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 mb-3">Vista previa del cálculo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Costo ejemplo:</span>
                        <span className="font-mono">$1,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Porcentaje aplicado:</span>
                        <span className="font-mono text-blue-600">{percentageInput}%</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-600 font-medium">Precio sugerido:</span>
                        <span className="font-mono font-bold text-green-600">
                          ${(1000 * (1 + percentageInput / 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={applyPercentage}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Aplicar Porcentaje
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        {summary && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-slate-800">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                  </div>
                  Resultados ({products.length} productos)
                </CardTitle>
                {products.length > 0 && (
                  <Button onClick={exportToExcel} variant="outline" className="border-slate-300">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar a Excel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {products.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">
                    {summary ? 'No se encontraron productos' : 'Carga archivos para comenzar'}
                  </h3>
                  <p className="text-slate-500">
                    {summary ? 'Intenta ajustar los filtros de búsqueda' : 'Selecciona archivos Excel para analizar productos'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          <Checkbox
                            checked={selectedProducts.size === products.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts(new Set(products.map(p => p.codigo)));
                              } else {
                                setSelectedProducts(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Producto
                        </th>
                        {summary.locals.map(local => (
                          <th key={local} className="px-4 py-4 text-center text-xs font-medium text-slate-600 uppercase tracking-wider border-l">
                            {local}
                          </th>
                        ))}
                        <th className="px-4 py-4 text-center text-xs font-medium text-slate-600 uppercase tracking-wider border-l">
                          Análisis
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {products.map((product, index) => {
                        const gainIndicator = getGainIndicator(product.porcentaje_ganancia_actual || 0);
                        const GainIcon = gainIndicator.icon;
                        
                        return (
                          <tr key={product.codigo} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4">
                              <Checkbox
                                checked={selectedProducts.has(product.codigo)}
                                onCheckedChange={() => toggleProductSelection(product.codigo)}
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <div className="font-mono text-sm text-slate-600">
                                  {product.codigo}
                                </div>
                                <div className="font-medium text-slate-900 max-w-xs">
                                  {product.nombre}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {product.categoria}
                                </Badge>
                              </div>
                            </td>
                            {summary.locals.map(local => {
                              const localData = product.locales[local];
                              const stockIndicator = localData ? getStockIndicator(localData.stock) : null;
                              
                              return (
                                <td key={local} className="px-4 py-4 text-center border-l">
                                  {localData ? (
                                    <div className="space-y-2">
                                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stockIndicator.bg} ${stockIndicator.color}`}>
                                        Stock: {localData.stock}
                                      </div>
                                      <div className="text-sm text-slate-600">
                                        Costo: <span className="font-mono">${localData.costo_neto?.toFixed(2)}</span>
                                      </div>
                                      <div className="text-sm font-medium text-slate-900">
                                        Venta: <span className="font-mono">${localData.precio_venta?.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 text-sm">
                                      Sin datos
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 text-center border-l">
                              <div className="space-y-2">
                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gainIndicator.bg} ${gainIndicator.color}`}>
                                  <GainIcon className="h-4 w-4 mr-1" />
                                  {product.porcentaje_ganancia_actual?.toFixed(1)}%
                                </div>
                                <div className="text-sm text-slate-600">
                                  Sugerido: <span className="font-mono font-medium">${product.precio_sugerido_calculado?.toFixed(2)}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App


// Forced redeploy comment to trigger Vercel build

