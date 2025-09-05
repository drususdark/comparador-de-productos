import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Upload, Search, Filter, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Label } from '@/components/ui/label.jsx'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx'

function App() {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [allProductsData, setAllProductsData] = useState([]) // Stores all processed data from all files
  const [products, setProducts] = useState([]) // Filtered products for display
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [percentageInput, setPercentageInput] = useState('')
  const [applyScope, setApplyScope] = useState('selected') // 'selected', 'category', 'all'
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
      'Precio Sugerido': 'precio_sugerido_excel', // Original suggested price from Excel
      'Porcentaje de Venta': 'porcentaje_venta_excel', // Original percentage from Excel
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
        product.porcentaje_ganancia_actual = 0; // Or handle as appropriate
      }

      // Initialize suggested price with current price, will be updated by user input
      product.precio_sugerido_calculado = product.precio_venta;

      return product;
    }).filter(p => p.codigo && p.nombre); // Filter out rows without essential data

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
          precio_sugerido_calculado: product.precio_sugerido_calculado, // Keep track of calculated suggested price
          porcentaje_ganancia_actual: product.porcentaje_ganancia_actual // Keep track of current percentage
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

    // Create header row dynamically based on available locals
    let headerRow = ['Código', 'Nombre', 'Categoría'];
    locals.forEach(local => {
      headerRow.push(`${local} Stock`);
      headerRow.push(`${local} Costo`);
      headerRow.push(`${local} Venta`);
    });
    headerRow.push('Porcentaje Ganancia Actual');
    headerRow.push('Precio Sugerido Calculado');
    dataForExcel.push(headerRow);

    // Add product data
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
          row.push('-', '-', '-'); // No data for this local
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
    saveAs(data, 'comparacion_precios.muevos.xlsx');
  };

  const handlePercentageChange = (e) => {
    setPercentageInput(e.target.value);
  };

  const applyPercentage = () => {
    const percentage = parseFloat(percentageInput);
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
    applyFiltersAndSearch(); // Re-apply filters to update displayed products
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Comparador de Precios
          </h1>
          <p className="text-gray-600">
            Compara precios de productos entre múltiples locales y analiza ganancias
          </p>
        </div>

        {/* File Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Cargar Archivos Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input
                  type="file"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mb-2"
                />
                <p className="text-sm text-gray-500">
                  Selecciona uno o más archivos Excel (.xlsx, .xls)
                </p>
              </div>
              
              {files.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Archivos seleccionados:</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <Badge key={index} variant="secondary">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleUpload} 
                disabled={isLoading || files.length === 0}
                className="w-full"
              >
                {isLoading ? 'Procesando...' : 'Cargar y Procesar Archivos'}
              </Button>

              {uploadStatus && (
                <div className={`p-3 rounded-md ${
                  uploadStatus.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {uploadStatus.message}
                </div>
              )}

              {summary && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h3 className="font-medium text-blue-900 mb-2">Resumen de datos cargados:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Productos:</span> {summary.total_products}
                    </div>
                    <div>
                      <span className="font-medium">Locales:</span> {summary.locals.length}
                    </div>
                    <div>
                      <span className="font-medium">Categorías:</span> {summary.categories.length}
                    </div>
                    <div>
                      <span className="font-medium">Archivos:</span> {summary.files_processed}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters Section */}
        {summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Búsqueda y Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Buscar producto
                  </label>
                  <Input
                    placeholder="Código o nombre del producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Categoría
                  </label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
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

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Filtro de stock
                  </label>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger>
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
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Aplicar Porcentaje de Venta Sugerido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Porcentaje a aplicar (%)
                  </label>
                  <Input
                    type="number"
                    placeholder="Ej: 25 (para 25%)"
                    value={percentageInput}
                    onChange={handlePercentageChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Ámbito de aplicación
                  </label>
                  <RadioGroup value={applyScope} onValueChange={setApplyScope} className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="selected" id="r1" />
                      <Label htmlFor="r1">Productos seleccionados</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="category" id="r2" />
                      <Label htmlFor="r2">Categoría actual ({selectedCategory === 'all' ? 'Todas' : selectedCategory})</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="r3" />
                      <Label htmlFor="r3">Todos los productos cargados</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <Button onClick={applyPercentage} className="w-full mt-4">
                Aplicar Porcentaje
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {summary && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Resultados ({products.length} productos)
                </CardTitle>
                
                {products.length > 0 && (
                  <div className="flex gap-2">
                    <Button onClick={exportToExcel} variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar a Excel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {summary ? 'No se encontraron productos con los filtros aplicados' : 'Carga archivos Excel para comenzar'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Sel.</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Código</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Nombre</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Categoría</th>
                        {summary.locals.map(local => (
                          <th key={local} className="border border-gray-300 px-4 py-2 text-center" colSpan="3">
                            {local}
                          </th>
                        ))}
                        <th className="border border-gray-300 px-4 py-2 text-center">% Ganancia Actual</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Precio Sugerido</th>
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-1"></th>
                        <th className="border border-gray-300 px-4 py-1"></th>
                        <th className="border border-gray-300 px-4 py-1"></th>
                        <th className="border border-gray-300 px-4 py-1"></th>
                        {summary.locals.map(local => (
                          <>
                            <th key={`${local}-stock`} className="border border-gray-300 px-2 py-1 text-xs">Stock</th>
                            <th key={`${local}-costo`} className="border border-gray-300 px-2 py-1 text-xs">Costo</th>
                            <th key={`${local}-venta`} className="border border-gray-300 px-2 py-1 text-xs">Venta</th>
                          </>
                        ))}
                        <th className="border border-gray-300 px-4 py-1"></th>
                        <th className="border border-gray-300 px-4 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => (
                        <tr key={product.codigo} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <Checkbox
                              checked={selectedProducts.has(product.codigo)}
                              onCheckedChange={() => toggleProductSelection(product.codigo)}
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                            {product.codigo}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {product.nombre}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <Badge variant="outline">{product.categoria}</Badge>
                          </td>
                          {summary.locals.map(local => {
                            const localData = product.locales[local];
                            return localData ? (
                              <>
                                <td key={`${local}-stock`} className="border border-gray-300 px-2 py-2 text-center text-sm">
                                  <span className={localData.stock < 0 ? 'text-red-600 font-medium' : localData.stock === 0 ? 'text-yellow-600' : 'text-green-600'}>
                                    {localData.stock}
                                  </span>
                                </td>
                                <td key={`${local}-costo`} className="border border-gray-300 px-2 py-2 text-right text-sm">
                                  ${localData.costo_neto?.toFixed(2) || '0.00'}
                                </td>
                                <td key={`${local}-venta`} className="border border-gray-300 px-2 py-2 text-right text-sm font-medium">
                                  ${localData.precio_venta?.toFixed(2) || '0.00'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td key={`${local}-stock`} className="border border-gray-300 px-2 py-2 text-center text-gray-400">-</td>
                                <td key={`${local}-costo`} className="border border-gray-300 px-2 py-2 text-center text-gray-400">-</td>
                                <td key={`${local}-venta`} className="border border-gray-300 px-2 py-2 text-center text-gray-400">-</td>
                              </>
                            );
                          })}
                          <td className="border border-gray-300 px-4 py-2 text-right text-sm">
                            {product.porcentaje_ganancia_actual?.toFixed(2)}%
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-sm font-medium">
                            ${product.precio_sugerido_calculado?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
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

export default App;
