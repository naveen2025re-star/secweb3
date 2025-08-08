# Changelog

All notable changes to SecWeb3 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-17

### 🎨 Major UI/UX Redesign
- **BREAKING**: Complete redesign to ChatGPT-style interface
- Replaced previous two-panel layout with modern sidebar + chat interface
- Added dark theme with gray-800/gray-900 color scheme matching ChatGPT
- Implemented conversation management with sidebar navigation
- Added professional message layout with user/AI avatars
- Enhanced typography and spacing for better readability

### ✨ New Features
- **Chat Interface**: Added ChatGPT-style conversational interface for security auditing
- **Sidebar Navigation**: New sidebar with conversation history and management
- **Conversation Groups**: Conversations grouped by time (Today, Yesterday, Previous 7 days)
- **Bottom Input Field**: ChatGPT-style input area with file attachment support
- **Streaming Optimization**: Reduced blinking during response streaming (updates every 3 chunks)
- **Security Audit Results**: Enhanced professional display for vulnerability reports
- **Quick Actions**: Added quick action buttons for common security checks
- **Copy Functionality**: Added copy buttons for AI responses
- **Real-time Updates**: Optimized streaming with better performance

### 🛡️ Security Analysis Enhancements
- **SecurityAuditResults Component**: New specialized component for displaying vulnerabilities
- **Severity Indicators**: Color-coded severity levels (Critical, High, Medium, Low)
- **Expandable Issue Details**: Click to expand vulnerability details with code snippets
- **Vulnerability Categorization**: Automatic parsing and categorization of security issues
- **Remediation Suggestions**: Detailed fix recommendations for each vulnerability
- **Code Highlighting**: Enhanced syntax highlighting for vulnerable code sections

### 🔧 Technical Improvements
- **Component Architecture**: Restructured into modular components (Sidebar, ChatInterface, ChatInput)
- **State Management**: Optimized state handling to reduce unnecessary re-renders
- **Performance**: Implemented debounced scrolling and optimized streaming updates
- **Error Handling**: Improved error boundaries and user-friendly error messages
- **Accessibility**: Enhanced accessibility with proper ARIA labels and keyboard navigation
- **Responsive Design**: Fully responsive layout optimized for all screen sizes

### 🏷️ Branding Updates
- **Name Change**: Rebranded from "Smart Contract Auditor" to "SecWeb3"
- **Package Name**: Updated package.json name to "secweb3"
- **Title Updates**: Changed all UI text to use SecWeb3 branding
- **Conversation Titles**: Updated example conversations with SecWeb3 naming
- **Placeholder Text**: Changed input placeholder to "Message SecWeb3..."
- **Disclaimer**: Updated footer text for SecWeb3 branding
- **Meta Data**: Updated HTML title and meta description

### 🐛 Bug Fixes
- **Fixed**: Resolved "darkMode is not defined" ReferenceError
- **Fixed**: Removed unused imports causing build errors
- **Fixed**: Corrected invalid Tailwind CSS classes (bg-gray-750 → bg-gray-700)
- **Fixed**: Fixed undefined variable references in component props
- **Fixed**: Resolved SyntaxHighlighter import issues
- **Fixed**: Cleaned up duplicate MarkdownRenderer implementations
- **Fixed**: Removed conflicting CSS styles and class names

### 📦 Dependencies
- **Updated**: react-syntax-highlighter to v15.5.0 (properly integrated)
- **Maintained**: All existing Shipable AI integration and backend logic
- **Preserved**: Express backend server with CORS and rate limiting
- **Kept**: All security analysis functionality intact

### 📚 Documentation
- **README.md**: Complete rewrite with SecWeb3 branding and features
- **Package Description**: Updated with comprehensive feature list
- **Usage Instructions**: Added detailed setup and usage guide
- **Technology Stack**: Documented all technologies and frameworks used
- **Contributing Guidelines**: Added contribution and support information

### 🔄 Migration Notes
- **Breaking Change**: UI completely redesigned - users will need to adapt to new interface
- **Data Compatibility**: All existing backend APIs and data structures remain unchanged
- **Configuration**: No changes required to existing environment variables
- **Deployment**: Same deployment process, just updated frontend assets

### 🚀 Performance Improvements
- **Streaming**: Reduced UI blinking by batching updates every 3 chunks instead of every chunk
- **Rendering**: Optimized React components to prevent unnecessary re-renders
- **Memory**: Improved memory usage with better component lifecycle management
- **Loading**: Faster initial load times with optimized component structure

### 🎯 User Experience Enhancements
- **Professional Interface**: Modern, clean design similar to leading AI chat platforms
- **Intuitive Navigation**: Easy-to-use sidebar with conversation management
- **Better Feedback**: Clear visual indicators for analysis status and progress
- **Improved Accessibility**: Better screen reader support and keyboard navigation
- **Mobile Responsive**: Optimized experience across all device sizes

### 🔐 Security Features Maintained
- **Shipable AI Integration**: All existing security analysis capabilities preserved
- **Multi-language Support**: Continued support for Solidity, Vyper, Move, and Cairo
- **Vulnerability Detection**: All vulnerability detection features intact
- **Streaming Analysis**: Real-time security analysis streaming maintained
- **Error Handling**: Robust error handling for API failures and network issues

---

**Note**: This major version represents a complete UI/UX transformation while maintaining all core security analysis functionality. The backend integration with Shipable AI remains unchanged, ensuring continuity of security auditing capabilities.
