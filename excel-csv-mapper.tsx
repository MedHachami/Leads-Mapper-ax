"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, Download, FileText, Settings, Eye, Trash2, AlertCircle, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import * as XLSX from "xlsx"


interface FileData {
  name: string
  headers: string[]
  rows: string[][]
  size: number
  type: string
  sheets?: string[]
  selectedSheet?: string
}

interface FieldMapping {
  [fileName: string]: {
    name: string[]
    phone: string[]
    address: string[]
    postalCode: string[]
    city: string[]
  }
}

interface ExtractedRecord {
  name: string
  phone: string
  address: string
  postalCode: string
  city: string
  sourceFile: string
  sheet?: string
}

interface FilterOptions {
  onlyPortableNumbers: boolean
  removeInvalidPostalCodes: boolean
  removeNullPhones: boolean
  removeEmptyNames: boolean
  filterByPostalCode: boolean
}

interface FilterStats {
  totalRecords: number
  filteredRecords: number
  removedByPortableFilter: number
  removedByPostalCodeFilter: number
  removedByNullPhoneFilter: number
}

export default function ExcelCSVMapper() {
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({})
  const [extractedData, setExtractedData] = useState<ExtractedRecord[]>([])
  const [filteredData, setFilteredData] = useState<ExtractedRecord[]>([])
  const [currentStep, setCurrentStep] = useState<"upload" | "mapping" | "filtering" | "results">("upload")
  const [selectedFile, setSelectedFile] = useState<string>("")
  const [processingErrors, setProcessingErrors] = useState<string[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    onlyPortableNumbers: true,
    removeInvalidPostalCodes: true,
    removeNullPhones: true,
    removeEmptyNames: true,
    filterByPostalCode: false,
  })
  const [allowedPostalCodes, setAllowedPostalCodes] = useState<string>("")
  const [splitIntoFiles, setSplitIntoFiles] = useState<boolean>(true)
  const [recordsPerFile, setRecordsPerFile] = useState<number>(8000)
  const [filterStats, setFilterStats] = useState<FilterStats>({
    totalRecords: 0,
    filteredRecords: 0,
    removedByPortableFilter: 0,
    removedByPostalCodeFilter: 0,
    removedByNullPhoneFilter: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Enhanced CSV parser with better delimiter detection
  const parseCSV = (csvText: string): { headers: string[]; rows: string[][] } => {
    // Detect delimiter
    const delimiters = [",", ";", "\t", "|"]
    let bestDelimiter = ","
    let maxColumns = 0

    for (const delimiter of delimiters) {
      const testLine = csvText.split(/\r?\n/)[0]
      const columns = testLine.split(delimiter).length
      if (columns > maxColumns) {
        maxColumns = columns
        bestDelimiter = delimiter
      }
    }

    const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length === 0) throw new Error("Empty file")

    const parseRow = (row: string): string[] => {
      const cells: string[] = []
      let inQuote = false
      let currentCell = ""

      for (let i = 0; i < row.length; i++) {
        const char = row[i]

        if (char === '"') {
          if (inQuote && i + 1 < row.length && row[i + 1] === '"') {
            currentCell += '"'
            i++
          } else {
            inQuote = !inQuote
          }
        } else if (char === bestDelimiter && !inQuote) {
          cells.push(currentCell.trim())
          currentCell = ""
        } else {
          currentCell += char
        }
      }

      cells.push(currentCell.trim())
      return cells
    }

    const headers = parseRow(lines[0]).map((h) => h.replace(/^["']|["']$/g, ""))
    const rows = lines
      .slice(1)
      .map(parseRow)
      .filter((row) => row.some((cell) => cell.trim()))
      .map((row) => row.map((cell) => cell.replace(/^["']|["']$/g, "")))

    return { headers, rows }
  }

  // Excel parser using SheetJS
  const parseExcel = async (
    file: File,
  ): Promise<{ sheets: { [key: string]: { headers: string[]; rows: string[][] } } }> => {
    // Import SheetJS dynamically

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    const sheets: { [key: string]: { headers: string[]; rows: string[][] } } = {}

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as string[][]

      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h) => String(h || "").trim())
        const rows = jsonData
          .slice(1)
          .filter((row) => row.some((cell) => String(cell || "").trim()))
          .map((row) => row.map((cell) => String(cell || "").trim()))

        sheets[sheetName] = { headers, rows }
      }
    })

    return { sheets }
  }

  // Clean and format phone numbers
  const cleanPhoneNumber = (phone: string): string => {
    if (!phone) return ""

    // Remove all spaces, dots, dashes, parentheses
    let cleanPhone = phone.replace(/[\s\-.()]/g, "")

    // Handle +33 prefix
    if (cleanPhone.startsWith("+33")) {
      cleanPhone = cleanPhone.substring(3)
    }
    // Handle 0033 prefix
    else if (cleanPhone.startsWith("0033")) {
      cleanPhone = cleanPhone.substring(4)
    }
    // Handle 33 prefix (without + or 00)
    else if (cleanPhone.startsWith("33") && cleanPhone.length >= 9) {
      cleanPhone = cleanPhone.substring(2)
    }

    // Add leading 0 if missing
    if (!cleanPhone.startsWith("0") && cleanPhone.length === 9) {
      cleanPhone = "0" + cleanPhone
    }

    return cleanPhone
  }

  // Filter functions
  const isPortableNumber = (phone: string): boolean => {
    if (!phone) return false

    const cleanPhone = cleanPhoneNumber(phone)

    // Must be exactly 10 digits and start with 06 or 07
    return /^0[67]\d{8}$/.test(cleanPhone)
  }

  const isValidPostalCode = (postalCode: string): boolean => {
    if (!postalCode) return true // Don't filter out empty postal codes

    const cleanCode = postalCode.replace(/\s/g, "")
    // Remove records if postal code ends with 000 and is exactly 5 digits
    return !(cleanCode.length === 5 && cleanCode.endsWith("000"))
  }

  const isPhoneNotNull = (phone: string): boolean => {
    return phone.trim() !== ""
  }

  const isNameNotEmpty = (name: string): boolean => {
    return name.trim() !== ""
  }

  const isPostalCodeAllowed = (postalCode: string, allowedCodes: string[]): boolean => {
    if (allowedCodes.length === 0) return true
    return allowedCodes.some((code) => postalCode.startsWith(code.trim()))
  }

  const applyFilters = (data: ExtractedRecord[]): { filtered: ExtractedRecord[]; stats: FilterStats } => {
    let filtered = [...data]
    const stats: FilterStats = {
      totalRecords: data.length,
      filteredRecords: 0,
      removedByPortableFilter: 0,
      removedByPostalCodeFilter: 0,
      removedByNullPhoneFilter: 0,
    }

    // Filter: Remove null/empty phone numbers
    if (filterOptions.removeNullPhones) {
      const beforeCount = filtered.length
      filtered = filtered.filter((record) => isPhoneNotNull(record.phone))
      stats.removedByNullPhoneFilter = beforeCount - filtered.length
    }

    // Filter: Remove empty names
    if (filterOptions.removeEmptyNames) {
      filtered = filtered.filter((record) => isNameNotEmpty(record.name))
    }

    // Filter 1: Only portable numbers (06/07)
    if (filterOptions.onlyPortableNumbers) {
      const beforeCount = filtered.length
      filtered = filtered.filter((record) => isPortableNumber(record.phone))
      stats.removedByPortableFilter = beforeCount - filtered.length
    }

    // Filter 2: Remove invalid postal codes (ending with 000)
    if (filterOptions.removeInvalidPostalCodes) {
      const beforeCount = filtered.length
      filtered = filtered.filter((record) => isValidPostalCode(record.postalCode))
      stats.removedByPostalCodeFilter = beforeCount - filtered.length
    }

    // Filter: Keep only specific postal codes
    if (filterOptions.filterByPostalCode && allowedPostalCodes.trim()) {
      const allowedCodes = allowedPostalCodes
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean)
      filtered = filtered.filter((record) => isPostalCodeAllowed(record.postalCode, allowedCodes))
    }

    stats.filteredRecords = filtered.length
    return { filtered, stats }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const fileDataArray: FileData[] = []
    const newMappings: FieldMapping = {}
    const errors: string[] = []

    for (const file of Array.from(files)) {
      try {
        const fileExtension = file.name.split(".").pop()?.toLowerCase()

        if (fileExtension === "csv" || fileExtension === "txt") {
          // Handle CSV files
          const text = await file.text()
          const { headers, rows } = parseCSV(text)

          const fileData: FileData = {
            name: file.name,
            headers,
            rows,
            size: file.size,
            type: "csv",
          }

          fileDataArray.push(fileData)
          newMappings[file.name] = {
            name: [],
            phone: [],
            address: [],
            postalCode: [],
            city: [],
          }
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Handle Excel files
          const { sheets } = await parseExcel(file)
          const sheetNames = Object.keys(sheets)

          if (sheetNames.length === 0) {
            errors.push(`${file.name}: No readable sheets found`)
            continue
          }

          // Use first sheet by default
          const firstSheet = sheetNames[0]
          const sheetData = sheets[firstSheet]

          const fileData: FileData = {
            name: file.name,
            headers: sheetData.headers,
            rows: sheetData.rows,
            size: file.size,
            type: "excel",
            sheets: sheetNames,
            selectedSheet: firstSheet,
          }

          fileDataArray.push(fileData)
          newMappings[file.name] = {
            name: [],
            phone: [],
            address: [],
            postalCode: [],
            city: [],
          }
        } else {
          errors.push(`${file.name}: Unsupported file format. Please use CSV, XLSX, or XLS files.`)
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    setUploadedFiles(fileDataArray)
    setFieldMappings(newMappings)
    setProcessingErrors(errors)

    if (fileDataArray.length > 0) {
      setCurrentStep("mapping")
      setSelectedFile(fileDataArray[0].name)
    }
  }

  const handleSheetChange = async (fileName: string, sheetName: string) => {
    const file = uploadedFiles.find((f) => f.name === fileName)
    if (!file || file.type !== "excel") return

    try {
      // Re-parse the Excel file to get the selected sheet
      const originalFile = fileInputRef.current?.files
      if (!originalFile) return

      const targetFile = Array.from(originalFile).find((f) => f.name === fileName)
      if (!targetFile) return

      const { sheets } = await parseExcel(targetFile)
      const sheetData = sheets[sheetName]

      // Update the file data
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === fileName
            ? { ...f, headers: sheetData.headers, rows: sheetData.rows, selectedSheet: sheetName }
            : f,
        ),
      )

      // Reset mappings for this file
      setFieldMappings((prev) => ({
        ...prev,
        [fileName]: {
          name: [],
          phone: [],
          address: [],
          postalCode: [],
          city: [],
        },
      }))
    } catch (error) {
      console.error("Error changing sheet:", error)
    }
  }

  const addFieldHeader = (fileName: string, field: keyof FieldMapping[string], header: string) => {
    const currentHeaders = fieldMappings[fileName]?.[field] || []
    if (!currentHeaders.includes(header)) {
      setFieldMappings((prev) => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          [field]: [...currentHeaders, header],
        },
      }))
    }
  }

  const removeFieldHeader = (fileName: string, field: keyof FieldMapping[string], header: string) => {
    const currentHeaders = fieldMappings[fileName]?.[field] || []
    setFieldMappings((prev) => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [field]: currentHeaders.filter((h) => h !== header),
      },
    }))
  }

  const extractData = () => {
    const allExtractedData: ExtractedRecord[] = []

    uploadedFiles.forEach((file) => {
      const mapping = fieldMappings[file.name]
      if (!mapping) return

      file.rows.forEach((row) => {
        const getFieldValue = (headerName: string): string => {
          const index = file.headers.indexOf(headerName)
          return index >= 0 && index < row.length ? row[index]?.trim() || "" : ""
        }

        const combineFields = (fieldHeaders: string[]): string => {
          return fieldHeaders
            .map((header) => getFieldValue(header))
            .filter(Boolean)
            .join(" ")
            .trim()
        }

        // Clean phone number during extraction
        const rawPhone = combineFields(mapping.phone)
        const cleanedPhone = rawPhone ? cleanPhoneNumber(rawPhone) : ""

        const record: ExtractedRecord = {
          name: combineFields(mapping.name),
          phone: cleanedPhone,
          address: combineFields(mapping.address),
          postalCode: combineFields(mapping.postalCode),
          city: combineFields(mapping.city),
          sourceFile: file.name,
          sheet: file.selectedSheet,
        }

        if (record.name || record.phone || record.address || record.postalCode || record.city) {
          allExtractedData.push(record)
        }
      })
    })

    setExtractedData(allExtractedData)
    setCurrentStep("filtering")
  }

  const applyFiltersAndProceed = () => {
    const { filtered, stats } = applyFilters(extractedData)
    setFilteredData(filtered)
    setFilterStats(stats)
    setCurrentStep("results")
  }

  const downloadCSV = () => {
    const dataToDownload = filteredData.length > 0 ? filteredData : extractedData
    if (dataToDownload.length === 0) return

    const headers = ["Name", "Phone", "Address", "Postal Code", "City", "Source File", "Sheet"]
    const csvContent = [
      headers.join(","),
      ...dataToDownload.map((record) =>
        [
          record.name,
          record.phone,
          record.address,
          record.postalCode,
          record.city,
          record.sourceFile,
          record.sheet || "",
        ]
          .map((field) => `"${field?.replace(/"/g, '""') || ""}"`)
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `filtered_data_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadMultipleCSV = () => {
    const dataToDownload = filteredData.length > 0 ? filteredData : extractedData
    if (dataToDownload.length === 0) return

    const headers = ["Name", "Phone", "Address", "Postal Code", "City", "Source File", "Sheet"]

    if (!splitIntoFiles || dataToDownload.length <= recordsPerFile) {
      // Download single file
      downloadCSV()
      return
    }

    // Split into multiple files
    const chunks = []
    for (let i = 0; i < dataToDownload.length; i += recordsPerFile) {
      chunks.push(dataToDownload.slice(i, i + recordsPerFile))
    }

    chunks.forEach((chunk, index) => {
      const csvContent = [
        headers.join(","),
        ...chunk.map((record) =>
          [
            record.name,
            record.phone,
            record.address,
            record.postalCode,
            record.city,
            record.sourceFile,
            record.sheet || "",
          ]
            .map((field) => `"${field?.replace(/"/g, '""') || ""}"`)
            .join(","),
        ),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vicidial_leads_part_${index + 1}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const resetProcess = () => {
    setUploadedFiles([])
    setFieldMappings({})
    setExtractedData([])
    setFilteredData([])
    setCurrentStep("upload")
    setSelectedFile("")
    setProcessingErrors([])
    setFilterStats({
      totalRecords: 0,
      filteredRecords: 0,
      removedByPortableFilter: 0,
      removedByPostalCodeFilter: 0,
      removedByNullPhoneFilter: 0,
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const isHeaderMapped = (fileName: string, header: string): boolean => {
    const mapping = fieldMappings[fileName]
    if (!mapping) return false
    return Object.values(mapping).some((headers) => headers.includes(header))
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${currentStep === "upload" ? "text-blue-600" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "upload" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                1
              </div>
              <span>Upload Files</span>
            </div>
            <div className={`flex items-center gap-2 ${currentStep === "mapping" ? "text-blue-600" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "mapping" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                2
              </div>
              <span>Map Headers</span>
            </div>
            <div
              className={`flex items-center gap-2 ${currentStep === "filtering" ? "text-blue-600" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "filtering" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                3
              </div>
              <span>Filter Data</span>
            </div>
            <div className={`flex items-center gap-2 ${currentStep === "results" ? "text-blue-600" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "results" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                4
              </div>
              <span>Results</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload Files */}
      {currentStep === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Step 1: Upload Files
            </CardTitle>
            <CardDescription>Upload CSV, XLSX, or XLS files to analyze their headers and structure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <Button onClick={() => fileInputRef.current?.click()} className="mb-2">
                Select Files
              </Button>
              <p className="text-sm text-gray-500">Supported formats: CSV, XLSX, XLS, TXT</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {processingErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p>Some files could not be processed:</p>
                    <ul className="list-disc list-inside text-sm">
                      {processingErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Headers */}
      {currentStep === "mapping" && uploadedFiles.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Step 2: Map Headers to Fields
              </CardTitle>
              <CardDescription>
                Select which headers from your files correspond to the data you want to extract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Label>Select File:</Label>
                <Select value={selectedFile} onValueChange={setSelectedFile}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a file" />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadedFiles.map((file) => (
                      <SelectItem key={file.name} value={file.name}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {file.type.toUpperCase()}
                          </Badge>
                          {file.name} ({file.rows.length} rows)
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sheet selector for Excel files */}
                {selectedFile && uploadedFiles.find((f) => f.name === selectedFile)?.type === "excel" && (
                  <>
                    <Label>Sheet:</Label>
                    <Select
                      value={uploadedFiles.find((f) => f.name === selectedFile)?.selectedSheet || ""}
                      onValueChange={(value) => handleSheetChange(selectedFile, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {uploadedFiles
                          .find((f) => f.name === selectedFile)
                          ?.sheets?.map((sheet) => (
                            <SelectItem key={sheet} value={sheet}>
                              {sheet}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedFile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Field Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Field Mapping for {selectedFile}</CardTitle>
                  {uploadedFiles.find((f) => f.name === selectedFile)?.selectedSheet && (
                    <CardDescription>
                      Sheet: {uploadedFiles.find((f) => f.name === selectedFile)?.selectedSheet}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="name">
                    <TabsList className="grid grid-cols-5 mb-4">
                      <TabsTrigger value="name">Name</TabsTrigger>
                      <TabsTrigger value="phone">Phone</TabsTrigger>
                      <TabsTrigger value="address">Address</TabsTrigger>
                      <TabsTrigger value="postalCode">Postal Code</TabsTrigger>
                      <TabsTrigger value="city">City</TabsTrigger>
                    </TabsList>

                    {(["name", "phone", "address", "postalCode", "city"] as const).map((field) => (
                      <TabsContent key={field} value={field} className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-lg capitalize">
                              {field.replace(/([A-Z])/g, " $1").trim()} Fields
                            </Label>
                            <Badge variant="outline">
                              {fieldMappings[selectedFile]?.[field]?.length || 0} columns selected
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Select one or more columns to combine for this field
                          </p>

                          {/* Selected headers */}
                          <div className="space-y-2 mt-4">
                            {fieldMappings[selectedFile]?.[field]?.map((header) => (
                              <div key={header} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <Badge variant="secondary">{header}</Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFieldHeader(selectedFile, field, header)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          {/* Add new header */}
                          <div className="mt-4">
                            <Select onValueChange={(value) => addFieldHeader(selectedFile, field, value)}>
                              <SelectTrigger>
                                <SelectValue placeholder={`Add ${field.replace(/([A-Z])/g, " $1").trim()} column`} />
                              </SelectTrigger>
                              <SelectContent>
                                {uploadedFiles
                                  .find((f) => f.name === selectedFile)
                                  ?.headers.filter((h) => !isHeaderMapped(selectedFile, h))
                                  .map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Data Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {uploadedFiles
                            .find((f) => f.name === selectedFile)
                            ?.headers.map((header) => (
                              <TableHead key={header} className="whitespace-nowrap">
                                {header}
                                {isHeaderMapped(selectedFile, header) && (
                                  <Badge variant="secondary" className="ml-1 text-xs">
                                    mapped
                                  </Badge>
                                )}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedFiles
                          .find((f) => f.name === selectedFile)
                          ?.rows.slice(0, 3)
                          .map((row, index) => (
                            <TableRow key={index}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex} className="whitespace-nowrap">
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Button onClick={extractData} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Extract Data from All Files
                </Button>
                <Button variant="outline" onClick={resetProcess}>
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Filter Data */}
      {currentStep === "filtering" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Step 3: Filter Data
              </CardTitle>
              <CardDescription>
                Apply filters to clean your data based on your requirements ({extractedData.length} records extracted)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Filter 1: Portable Numbers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📱 Portable Numbers Only</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="portable-filter"
                        checked={filterOptions.onlyPortableNumbers}
                        onCheckedChange={(checked) =>
                          setFilterOptions((prev) => ({ ...prev, onlyPortableNumbers: checked as boolean }))
                        }
                      />
                      <Label htmlFor="portable-filter">Keep only mobile numbers (06/07)</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Only keep phone numbers that start with 06 or 07. Automatically cleans +33 prefixes.
                    </p>
                    <div className="text-xs text-gray-500">
                      <p>✅ +33648753960 → 0648753960</p>
                      <p>✅ 33712345678 → 0712345678</p>
                      <p>✅ 0612345678 → 0612345678</p>
                      <p>❌ +33112345678 → Removed (landline)</p>
                      <p>❌ 0312345678 → Removed (landline)</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Filter 2: Postal Codes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📮 Valid Postal Codes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="postal-filter"
                        checked={filterOptions.removeInvalidPostalCodes}
                        onCheckedChange={(checked) =>
                          setFilterOptions((prev) => ({ ...prev, removeInvalidPostalCodes: checked as boolean }))
                        }
                      />
                      <Label htmlFor="postal-filter">Remove generic postal codes</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove postal codes ending with 000 (like 35000, 03000)
                    </p>
                    <div className="text-xs text-gray-500">
                      <p>✅ Valid: 35200, 03100, 75001</p>
                      <p>❌ Invalid: 35000, 03000, 75000</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Filter 3: Null Phones */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📞 Required Phone Numbers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="null-phone-filter"
                        checked={filterOptions.removeNullPhones}
                        onCheckedChange={(checked) =>
                          setFilterOptions((prev) => ({ ...prev, removeNullPhones: checked as boolean }))
                        }
                      />
                      <Label htmlFor="null-phone-filter">Remove records with empty phone numbers</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove records where the phone number field is empty or null
                    </p>
                    <div className="text-xs text-gray-500">
                      <p>✅ Valid: Any non-empty phone number</p>
                      <p>❌ Invalid: Empty, null, or whitespace only</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Filter 4: Empty Names */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">👤 Required Names</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="empty-name-filter"
                        checked={filterOptions.removeEmptyNames}
                        onCheckedChange={(checked) =>
                          setFilterOptions((prev) => ({ ...prev, removeEmptyNames: checked as boolean }))
                        }
                      />
                      <Label htmlFor="empty-name-filter">Remove records with empty names</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove records where the name field is empty or null
                    </p>
                  </CardContent>
                </Card>

                {/* Filter 5: Postal Code Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">🏘️ Specific Postal Codes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="postal-code-filter"
                        checked={filterOptions.filterByPostalCode}
                        onCheckedChange={(checked) =>
                          setFilterOptions((prev) => ({ ...prev, filterByPostalCode: checked as boolean }))
                        }
                      />
                      <Label htmlFor="postal-code-filter">Keep only specific postal codes</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allowed-postal-codes">Allowed Postal Codes (comma separated)</Label>
                      <Input
                        id="allowed-postal-codes"
                        value={allowedPostalCodes}
                        onChange={(e) => setAllowedPostalCodes(e.target.value)}
                        placeholder="35, 44, 75001, 13000"
                        disabled={!filterOptions.filterByPostalCode}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enter postal codes or prefixes separated by commas. Example: 35, 44, 75
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* File Splitting Options */}
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle className="text-lg">📁 File Splitting for CRM (Vicidial)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="split-files"
                      checked={splitIntoFiles}
                      onCheckedChange={(checked) => setSplitIntoFiles(checked as boolean)}
                    />
                    <Label htmlFor="split-files">Split data into multiple files for CRM import</Label>
                  </div>

                  {splitIntoFiles && (
                    <div className="space-y-2">
                      <Label htmlFor="records-per-file">Records per file (7000-9000 recommended)</Label>
                      <Input
                        id="records-per-file"
                        type="number"
                        min="1000"
                        max="10000"
                        value={recordsPerFile}
                        onChange={(e) => setRecordsPerFile(Number.parseInt(e.target.value) || 8000)}
                        className="w-32"
                      />
                      <p className="text-sm text-muted-foreground">
                        Optimal range: 7000-9000 records per file for Vicidial CRM
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button onClick={applyFiltersAndProceed} className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Apply Filters & Continue
                </Button>
                <Button variant="outline" onClick={() => setCurrentStep("results")}>
                  Skip Filtering
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Results */}
      {currentStep === "results" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Step 4: Final Results
              </CardTitle>
              <CardDescription>
                {filteredData.length > 0
                  ? `${filteredData.length} records after filtering`
                  : `${extractedData.length} records (no filters applied)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={downloadMultipleCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {splitIntoFiles &&
                  (filteredData.length > 0 ? filteredData.length : extractedData.length) > recordsPerFile
                    ? `Download Multiple Files (${Math.ceil((filteredData.length > 0 ? filteredData.length : extractedData.length) / recordsPerFile)} files)`
                    : `Download CSV (${filteredData.length > 0 ? filteredData.length : extractedData.length} records)`}
                </Button>
                <Button variant="outline" onClick={resetProcess}>
                  Process New Files
                </Button>
                <Button variant="outline" onClick={() => setCurrentStep("filtering")}>
                  Adjust Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filter Statistics */}
          {filteredData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Filter Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{filterStats.totalRecords}</div>
                    <div className="text-sm text-muted-foreground">Total Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{filterStats.filteredRecords}</div>
                    <div className="text-sm text-muted-foreground">Final Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{filterStats.removedByPortableFilter}</div>
                    <div className="text-sm text-muted-foreground">Non-Mobile Removed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{filterStats.removedByPostalCodeFilter}</div>
                    <div className="text-sm text-muted-foreground">Invalid Postal Removed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{filterStats.removedByNullPhoneFilter}</div>
                    <div className="text-sm text-muted-foreground">Empty Phone Removed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Postal Code</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Source File</TableHead>
                      <TableHead>Sheet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredData.length > 0 ? filteredData : extractedData).slice(0, 20).map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.name}</TableCell>
                        <TableCell>{record.phone}</TableCell>
                        <TableCell>{record.address}</TableCell>
                        <TableCell>{record.postalCode}</TableCell>
                        <TableCell>{record.city}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{record.sourceFile}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{record.sheet || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(filteredData.length > 0 ? filteredData : extractedData).length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing first 20 of {filteredData.length > 0 ? filteredData.length : extractedData.length} records.
                  Download CSV to see all data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
