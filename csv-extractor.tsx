"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, FileText, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CSVData {
  headers: string[]
  rows: string[][]
  fileName: string
}

interface FieldMapping {
  name: string | null
  phone: string | null
  address: string | null
  postalCode: string | null
  city: string | null
}

interface ExtractedRecord {
  name: string
  phone: string
  address: string
  postalCode: string
  city: string
}

export default function CSVExtractor() {
  const [csvData, setCsvData] = useState<CSVData | null>(null)
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    name: null,
    phone: null,
    address: null,
    postalCode: null,
    city: null,
  })
  const [extractedData, setExtractedData] = useState<ExtractedRecord[]>([])
  const [urlInput, setUrlInput] = useState(
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%2068%20-Dn9oJGNFOFs1CuflztlZkvsBwkoc5d.csv",
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-detect field mappings based on common header patterns
  const autoDetectFields = useCallback((headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {
      name: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
    }

    headers.forEach((header) => {
      const lowerHeader = header.toLowerCase().trim()

      // Name detection
      if (
        !mapping.name &&
        (lowerHeader.includes("nom") ||
          lowerHeader.includes("name") ||
          lowerHeader.includes("prénom") ||
          lowerHeader.includes("prenom") ||
          lowerHeader.includes("client") ||
          lowerHeader.includes("contact"))
      ) {
        mapping.name = header
      }

      // Phone detection
      if (
        !mapping.phone &&
        (lowerHeader.includes("tel") ||
          lowerHeader.includes("phone") ||
          lowerHeader.includes("téléphone") ||
          lowerHeader.includes("telephone") ||
          lowerHeader.includes("mobile") ||
          lowerHeader.includes("portable"))
      ) {
        mapping.phone = header
      }

      // Address detection
      if (
        !mapping.address &&
        (lowerHeader.includes("adresse") ||
          lowerHeader.includes("address") ||
          lowerHeader.includes("rue") ||
          lowerHeader.includes("street") ||
          lowerHeader.includes("addr"))
      ) {
        mapping.address = header
      }

      // Postal code detection
      if (
        !mapping.postalCode &&
        (lowerHeader.includes("postal") ||
          lowerHeader.includes("zip") ||
          lowerHeader.includes("cp") ||
          (lowerHeader.includes("code") && lowerHeader.includes("postal")))
      ) {
        mapping.postalCode = header
      }

      // City detection
      if (
        !mapping.city &&
        (lowerHeader.includes("ville") ||
          lowerHeader.includes("city") ||
          lowerHeader.includes("commune") ||
          lowerHeader.includes("localité") ||
          lowerHeader.includes("localite"))
      ) {
        mapping.city = header
      }
    })

    return mapping
  }, [])

  const parseCSV = (csvText: string, fileName: string): CSVData => {
    const lines = csvText.split("\n").filter((line) => line.trim())
    if (lines.length === 0) throw new Error("Empty CSV file")

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
    const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim().replace(/"/g, "")))

    return { headers, rows, fileName }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const data = parseCSV(text, file.name)
      setCsvData(data)

      const autoMapping = autoDetectFields(data.headers)
      setFieldMapping(autoMapping)
    } catch (err) {
      setError(`Error reading file: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(urlInput)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

      const text = await response.text()
      const fileName = urlInput.split("/").pop() || "file.csv"
      const data = parseCSV(text, fileName)
      setCsvData(data)

      const autoMapping = autoDetectFields(data.headers)
      setFieldMapping(autoMapping)
    } catch (err) {
      setError(`Error loading URL: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const extractData = () => {
    if (!csvData) return

    const extracted: ExtractedRecord[] = csvData.rows
      .map((row) => {
        const getFieldValue = (fieldHeader: string | null): string => {
          if (!fieldHeader) return ""
          const index = csvData.headers.indexOf(fieldHeader)
          return index >= 0 ? row[index] || "" : ""
        }

        return {
          name: getFieldValue(fieldMapping.name),
          phone: getFieldValue(fieldMapping.phone),
          address: getFieldValue(fieldMapping.address),
          postalCode: getFieldValue(fieldMapping.postalCode),
          city: getFieldValue(fieldMapping.city),
        }
      })
      .filter(
        (record) =>
          // Filter out completely empty records
          record.name || record.phone || record.address || record.postalCode || record.city,
      )

    setExtractedData(extracted)
  }

  const downloadCSV = () => {
    if (extractedData.length === 0) return

    const headers = ["Name", "Phone", "Address", "Postal Code", "City"]
    const csvContent = [
      headers.join(","),
      ...extractedData.map((record) =>
        [record.name, record.phone, record.address, record.postalCode, record.city]
          .map((field) => `"${field}"`)
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `extracted_${csvData?.fileName || "data"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Field Extractor
          </CardTitle>
          <CardDescription>
            Extract name, phone, address, postal code, and city from CSV files with varying headers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">Load from URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter CSV file URL"
                className="flex-1"
              />
              <Button onClick={handleUrlLoad} disabled={isLoading}>
                Load URL
              </Button>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Or upload a file</Label>
            <div className="flex items-center gap-2">
              <Input id="file" type="file" accept=".csv" onChange={handleFileUpload} disabled={isLoading} />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {csvData && (
        <Card>
          <CardHeader>
            <CardTitle>Field Mapping</CardTitle>
            <CardDescription>Map CSV headers to the required fields. Auto-detection has been applied.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(fieldMapping).map(([field, selectedHeader]) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</Label>
                  <Select
                    value={selectedHeader || "none"}
                    onValueChange={(value) => setFieldMapping((prev) => ({ ...prev, [field]: value || null }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select header" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {csvData.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={extractData} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Extract Data
              </Button>
              {extractedData.length > 0 && (
                <Button onClick={downloadCSV} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download CSV ({extractedData.length} records)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {csvData && (
        <Card>
          <CardHeader>
            <CardTitle>Original Data Preview</CardTitle>
            <CardDescription>First 5 rows from {csvData.fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvData.headers.map((header) => (
                      <TableHead key={header} className="whitespace-nowrap">
                        {header}
                        {Object.values(fieldMapping).includes(header) && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            mapped
                          </Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.rows.slice(0, 5).map((row, index) => (
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
      )}

      {extractedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
            <CardDescription>{extractedData.length} records extracted with required fields</CardDescription>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedData.slice(0, 10).map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>{record.phone}</TableCell>
                      <TableCell>{record.address}</TableCell>
                      <TableCell>{record.postalCode}</TableCell>
                      <TableCell>{record.city}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {extractedData.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing first 10 of {extractedData.length} records. Download CSV to see all data.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
