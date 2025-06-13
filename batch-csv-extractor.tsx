"use client"

import type React from "react"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Download, FileText, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ExtractedRecord {
  name: string
  phone: string
  address: string
  postalCode: string
  city: string
  sourceFile: string
}

interface ProcessedFile {
  fileName: string
  status: "success" | "error"
  message: string
  recordCount: number
  mappedFields: string[]
}

export default function BatchCSVExtractor() {
  const [extractedData, setExtractedData] = useState<ExtractedRecord[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentFile, setCurrentFile] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-detect field mappings based on your specific headers
  const detectFields = useCallback((headers: string[]) => {
    const mapping = {
      nom: null as string | null,
      prenom: null as string | null,
      phone: null as string | null,
      address: null as string | null,
      postalCode: null as string | null,
      city: null as string | null,
    }

    // Exact header matching for your specific format
    const headerMap: { [key: string]: keyof typeof mapping } = {
      nom: "nom",
      prénom: "prenom",
      prenom: "prenom",
      "adresse complète": "address",
      "adresse complete": "address",
      adresse: "address",
      "code postal": "postalCode",
      ville: "city",
      mobile: "phone",
      téléphone: "phone",
      telephone: "phone",
    }

    // Find exact matches first
    headers.forEach((header) => {
      const headerLower = header.toLowerCase().trim()
      if (headerMap[headerLower]) {
        mapping[headerMap[headerLower]] = header
      }
    })

    // If no phone found in Mobile, try Téléphone
    if (!mapping.phone) {
      const phoneHeader = headers.find(
        (h) =>
          h.toLowerCase().includes("téléphone") ||
          h.toLowerCase().includes("telephone") ||
          h.toLowerCase().includes("tel"),
      )
      if (phoneHeader) mapping.phone = phoneHeader
    }

    return mapping
  }, [])

  const parseCSV = (csvText: string): { headers: string[]; rows: string[][] } => {
    // Handle different delimiters and quote styles
    let delimiter = ","
    if (csvText.includes(";") && !csvText.includes(",")) {
      delimiter = ";"
    }

    // Basic CSV parsing with quote handling
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
            // Handle escaped quotes
            currentCell += '"'
            i++
          } else {
            // Toggle quote state
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
    const rows = lines.slice(1).map(parseRow)

    return { headers, rows }
  }

  const processFile = async (file: File): Promise<ProcessedFile> => {
    try {
      const text = await file.text()
      const { headers, rows } = parseCSV(text)

      // Auto-detect fields
      const mapping = detectFields(headers)

      // Extract data from rows
      const fileRecords: ExtractedRecord[] = rows
        .map((row) => {
          const getFieldValue = (fieldHeader: string | null): string => {
            if (!fieldHeader) return ""
            const index = headers.indexOf(fieldHeader)
            return index >= 0 && index < row.length ? row[index]?.trim() || "" : ""
          }

          // Concatenate nom and prénom
          const nom = getFieldValue(mapping.nom)
          const prenom = getFieldValue(mapping.prenom)
          const fullName = [nom, prenom].filter(Boolean).join(" ").trim()

          return {
            name: fullName,
            phone: getFieldValue(mapping.phone),
            address: getFieldValue(mapping.address),
            postalCode: getFieldValue(mapping.postalCode),
            city: getFieldValue(mapping.city),
            sourceFile: file.name,
          }
        })
        .filter(
          (record) =>
            // Filter out completely empty records
            record.name || record.phone || record.address || record.postalCode || record.city,
        )

      // Add to overall extracted data
      setExtractedData((prev) => [...prev, ...fileRecords])

      // Return processing result
      const mappedFields = Object.entries(mapping)
        .filter(([_, value]) => value !== null)
        .map(([key, _]) => {
          if (key === "nom" || key === "prenom") return "name (combined)"
          return key
        })
        .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates

      return {
        fileName: file.name,
        status: "success",
        message: `Extracted ${fileRecords.length} records`,
        recordCount: fileRecords.length,
        mappedFields,
      }
    } catch (err) {
      return {
        fileName: file.name,
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
        recordCount: 0,
        mappedFields: [],
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)
    setError(null)
    setProgress(0)
    setProcessedFiles([])

    try {
      const fileArray = Array.from(files)
      const results: ProcessedFile[] = []

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        setCurrentFile(file.name)
        setProgress(Math.round((i / fileArray.length) * 100))

        const result = await processFile(file)
        results.push(result)

        // Small delay to prevent UI freezing
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      setProcessedFiles(results)
      setProgress(100)
    } catch (err) {
      setError(`Error processing files: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
      setCurrentFile("")
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Batch CSV Field Extractor
          </CardTitle>
          <CardDescription>
            Extract name, phone, address, postal code, and city from multiple CSV files with varying headers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Select CSV Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
              {extractedData.length > 0 && (
                <Button onClick={downloadCSV} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Results ({extractedData.length} records)
                </Button>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Processing {currentFile}</span>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {processedFiles.length > 0 && (
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Processing Summary</TabsTrigger>
            <TabsTrigger value="data">Extracted Data</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Processing Results</CardTitle>
                <CardDescription>
                  {processedFiles.length} files processed, {extractedData.length} records extracted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Fields Mapped</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedFiles.map((file, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{file.fileName}</TableCell>
                        <TableCell>
                          {file.status === "success" ? (
                            <Badge variant="success" className="bg-green-100 text-green-800">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Error</Badge>
                          )}
                        </TableCell>
                        <TableCell>{file.recordCount}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {file.mappedFields.map((field) => (
                              <Badge key={field} variant="outline" className="capitalize">
                                {field.replace(/([A-Z])/g, " $1").trim()}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{file.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Extracted Data</CardTitle>
                <CardDescription>
                  Showing {Math.min(extractedData.length, 100)} of {extractedData.length} records
                </CardDescription>
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
                      {extractedData.slice(0, 100).map((record, index) => (
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
              </CardContent>
              <CardFooter>
                <Button onClick={downloadCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Complete Dataset
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
