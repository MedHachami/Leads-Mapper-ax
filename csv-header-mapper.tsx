"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, FileText, Settings, Eye, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface FileData {
  name: string
  headers: string[]
  rows: string[][]
  size: number
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
}

export default function CSVHeaderMapper() {
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({})
  const [extractedData, setExtractedData] = useState<ExtractedRecord[]>([])
  const [currentStep, setCurrentStep] = useState<"upload" | "mapping" | "results">("upload")
  const [selectedFile, setSelectedFile] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (csvText: string): { headers: string[]; rows: string[][] } => {
    // Handle different delimiters
    let delimiter = ","
    if (csvText.includes(";") && csvText.split(";").length > csvText.split(",").length) {
      delimiter = ";"
    }

    const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length === 0) throw new Error("Empty CSV file")

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
        } else if (char === delimiter && !inQuote) {
          cells.push(currentCell.trim())
          currentCell = ""
        } else {
          currentCell += char
        }
      }

      cells.push(currentCell.trim())
      return cells
    }

    const headers = parseRow(lines[0])
    const rows = lines
      .slice(1)
      .map(parseRow)
      .filter((row) => row.some((cell) => cell.trim()))

    return { headers, rows }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const fileDataArray: FileData[] = []
    const newMappings: FieldMapping = {}

    for (const file of Array.from(files)) {
      try {
        const text = await file.text()
        const { headers, rows } = parseCSV(text)

        fileDataArray.push({
          name: file.name,
          headers,
          rows,
          size: file.size,
        })

        // Initialize empty mapping for each file
        newMappings[file.name] = {
          name: [],
          phone: [],
          address: [],
          postalCode: [],
          city: [],
        }
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error)
      }
    }

    setUploadedFiles(fileDataArray)
    setFieldMappings(newMappings)
    if (fileDataArray.length > 0) {
      setCurrentStep("mapping")
      setSelectedFile(fileDataArray[0].name)
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

        // Combine fields for each category
        const combineFields = (fieldHeaders: string[]): string => {
          return fieldHeaders
            .map((header) => getFieldValue(header))
            .filter(Boolean)
            .join(" ")
            .trim()
        }

        const record: ExtractedRecord = {
          name: combineFields(mapping.name),
          phone: combineFields(mapping.phone),
          address: combineFields(mapping.address),
          postalCode: combineFields(mapping.postalCode),
          city: combineFields(mapping.city),
          sourceFile: file.name,
        }

        // Only add records that have at least one field filled
        if (record.name || record.phone || record.address || record.postalCode || record.city) {
          allExtractedData.push(record)
        }
      })
    })

    setExtractedData(allExtractedData)
    setCurrentStep("results")
  }

  const downloadCSV = () => {
    if (extractedData.length === 0) return

    const headers = ["Name", "Phone", "Address", "Postal Code", "City", "Source File"]
    const csvContent = [
      headers.join(","),
      ...extractedData.map((record) =>
        [record.name, record.phone, record.address, record.postalCode, record.city, record.sourceFile]
          .map((field) => `"${field?.replace(/"/g, '""') || ""}"`)
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `extracted_data_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetProcess = () => {
    setUploadedFiles([])
    setFieldMappings({})
    setExtractedData([])
    setCurrentStep("upload")
    setSelectedFile("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Helper to check if a header is already mapped to any field
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
            <div className={`flex items-center gap-2 ${currentStep === "results" ? "text-blue-600" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "results" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                3
              </div>
              <span>Extract Data</span>
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
              Step 1: Upload CSV Files
            </CardTitle>
            <CardDescription>Upload your CSV files to analyze their headers and structure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <Button onClick={() => fileInputRef.current?.click()} className="mb-2">
                Select CSV Files
              </Button>
              <p className="text-sm text-gray-500">Choose multiple CSV files to process</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
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
                Select which headers from your CSV files correspond to the data you want to extract
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
                        {file.name} ({file.rows.length} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedFile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Field Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Field Mapping for {selectedFile}</CardTitle>
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

      {/* Step 3: Results */}
      {currentStep === "results" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Step 3: Extracted Data
              </CardTitle>
              <CardDescription>
                {extractedData.length} records extracted from {uploadedFiles.length} files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={downloadCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download CSV ({extractedData.length} records)
                </Button>
                <Button variant="outline" onClick={resetProcess}>
                  Process New Files
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Data Preview</CardTitle>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedData.slice(0, 20).map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.name}</TableCell>
                        <TableCell>{record.phone}</TableCell>
                        <TableCell>{record.address}</TableCell>
                        <TableCell>{record.postalCode}</TableCell>
                        <TableCell>{record.city}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{record.sourceFile}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {extractedData.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing first 20 of {extractedData.length} records. Download CSV to see all data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
