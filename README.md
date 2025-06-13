# Leads-Mapper-ax - CSV/Excel Data Extraction Tool

A powerful web application for extracting, cleaning, and processing contact data from CSV and Excel files. Built with Next.js and designed for lead generation and data management workflows.

## 🚀 Features

### Core Functionality
- **Multi-format Support**: Process CSV, TXT, and Excel files (XLSX, XLS)
- **Flexible Input Methods**: Upload files directly or fetch from URLs
- **Smart Header Mapping**: Automatically detect and map column headers to standard fields
- **Batch Processing**: Handle multiple files simultaneously with different header structures
- **Real-time Preview**: See your data transformations before export

### Data Processing
- **Field Standardization**: Map various header formats to standard fields (Name, Email, Phone, etc.)
- **Name Concatenation**: Automatically combine first and last name fields
- **Phone Number Cleaning**: Remove invalid and non-portable phone numbers
- **Postal Code Filtering**: Filter records by postal code patterns
- **Data Validation**: Remove records with missing critical information

### Export Options
- **Clean CSV Export**: Download processed data in standardized format
- **Batch Export**: Export multiple processed files as a ZIP archive
- **Custom Field Selection**: Choose which fields to include in exports

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **File Processing**: Papa Parse (CSV), SheetJS (Excel)
- **Deployment**: Vercel

## 📋 Supported File Formats

- **CSV** (\`.csv\`)
- **Text** (\`.txt\` with comma/tab separation)
- **Excel** (\`.xlsx\`, \`.xls\`)

## 🎯 Use Cases

- **Lead Generation**: Clean and standardize prospect lists
- **CRM Data Import**: Prepare contact data for CRM systems
- **Marketing Campaigns**: Process subscriber lists and contact databases
- **Data Migration**: Convert between different contact data formats
- **List Cleaning**: Remove duplicates and invalid entries

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/MedHachami/Leads-Mapper-ax.git
cd Leads-Mapper-ax
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
pnpm install
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
# or
pnpm dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Deployment

The easiest way to deploy ContactRefinery is using Vercel:

\`\`\`bash
npm run build
vercel --prod
\`\`\`

## 📖 How to Use

### Single File Processing

1. **Upload or URL**: Choose to upload a file or provide a URL to a CSV/Excel file
2. **Header Mapping**: Review and map column headers to standard fields
3. **Data Preview**: Preview the processed data and apply filters
4. **Export**: Download the cleaned data as CSV

### Batch Processing

1. **Multiple Files**: Upload multiple files with potentially different header structures
2. **Individual Mapping**: Map headers for each file separately
3. **Unified Processing**: Apply consistent cleaning rules across all files
4. **Batch Export**: Download all processed files as a ZIP archive

### Data Cleaning Options

- **Phone Validation**: Remove non-portable phone numbers
- **Postal Code Filtering**: Filter by specific postal code patterns
- **Required Fields**: Remove records missing essential information
- **Name Standardization**: Combine separate name fields

## 🔧 Configuration

### Supported Header Variations

The application automatically recognizes various header formats:

- **Names**: "Name", "Full Name", "First Name + Last Name", "Contact Name"
- **Emails**: "Email", "Email Address", "E-mail", "Contact Email"
- **Phones**: "Phone", "Phone Number", "Mobile", "Cell", "Telephone"
- **Companies**: "Company", "Organization", "Business", "Employer"
- **Addresses**: "Address", "Street", "Location", "Full Address"

### Custom Mapping

You can manually map any column to standard fields using the header mapping interface.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues]([https://github.com/yourusername/contactrefinery/issues](https://github.com/MedHachami/Leads-Mapper-ax/issues)) page to report bugs or request new features.

## 📊 Roadmap

- [ ] Advanced data validation rules
- [ ] Custom export templates
- [ ] API integration for popular CRM systems
- [ ] Real-time collaboration features
- [ ] Advanced filtering and search capabilities
- [ ] Data visualization and analytics

## 💡 Tips & Best Practices

- **File Size**: For best performance, keep individual files under 10MB
- **Headers**: Ensure your CSV files have clear, descriptive headers
- **Encoding**: Use UTF-8 encoding for files with special characters
- **Backup**: Always keep a backup of your original data files

---

