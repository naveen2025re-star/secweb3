# Changelog

All notable changes to SecWeb3 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - 2025-08-14

### Fixed - Multi-File Upload System & Authentication
- **JWT Token Key Mismatch**: Fixed critical authentication issue where file components used 'authToken' instead of 'secweb3_token'
  - Updated FileUpload.jsx to use correct localStorage key for JWT tokens
  - Updated FileSelector.jsx to use correct localStorage key for JWT tokens  
  - Updated FileManager.jsx to use correct localStorage key for JWT tokens (all 3 instances)
  - Resolved "jwt malformed" errors in production environment
  - Fixed 401 Unauthorized errors on `/api/files` endpoint

- **File Upload Modal Integration**: Fixed missing upload functionality in file selection interface
  - Added missing FileUpload modal rendering logic to FileManager component
  - Added FileUpload modal integration to FileSelector component
  - Fixed FileSelector's "Upload Files" button that only closed selector instead of opening upload interface
  - Implemented proper modal state management with `showUploader` state

- **Production Authentication**: Enhanced JWT verification for Railway deployment
  - Added multi-secret JWT verification strategy for environment compatibility
  - Improved JWT handling to try multiple possible secrets (JWT_TOKEN, JWT_SECRET, SHIPABLE_JWT_TOKEN)
  - Added detailed logging for production authentication debugging
  - Enhanced error handling for token verification across different deployment environments

### Enhanced - File Upload User Experience  
- **Complete Upload Flow**: Unified file upload experience across all components
  - FileSelector's "Upload Files" button now opens functional upload modal
  - Drag & drop file upload with validation for .sol, .vy, .move, .cairo files
  - Auto-refresh file list after successful upload
  - Auto-close modal on upload completion
  - Proper success/error feedback with upload progress indicators

- **Authentication Robustness**: Improved authentication reliability in production
  - Flexible JWT secret handling for different deployment environments
  - Graceful fallback through multiple JWT secrets
  - Enhanced error reporting for authentication issues
  - Better compatibility between development and production environments

### Technical Improvements
- **Error Handling**: Added comprehensive error handling for file upload operations
- **State Management**: Improved modal state management for upload interfaces
- **Component Architecture**: Better integration between FileManager, FileSelector, and FileUpload components
- **Database Migration**: Ensured database tables creation on server startup for production deployments
- **Production Logging**: Enhanced logging for JWT verification and authentication debugging

### Developer Experience
- **Debugging**: Added detailed production logs for authentication troubleshooting
- **Error Messages**: Improved error messages for upload and authentication failures
- **Code Quality**: Fixed syntax errors and improved component structure
- **Documentation**: Enhanced code comments for upload flow and authentication logic

## [2.2.0] - 2025-08-13

### Added - Enhanced Backend & Frontend Integration
- **Shipable AI Integration**: Complete integration with Shipable AI streaming API
  - Proper multipart/form-data formatting using FormData API
  - Dynamic boundary generation for API requests
  - Session creation and streaming endpoints fully functional
  - Real-time streaming analysis with proper error handling
- **Smart Credits Management System**:
  - Intelligent credit deduction logic (only for contract analysis >50 chars)
  - Chat messages (like "HI") do not deduct credits
  - Automatic credit refunds on analysis failures
  - Real-time credit balance updates throughout the application
  - Credits history tracking with visual notifications
- **Enhanced User Experience**:
  - Beautiful gradient-styled credits display in header
  - Live credit balance updates with visual feedback
  - Professional slide-in notifications for credit changes
  - Modern pricing modal with Starter and Pro plans
  - Improved upgrade button with gradient styling and icons

### Added - New Pricing Plans
- **SecWeb3 Starter Plan**: 
  - US$0/month - Free tier
  - 1000 Starter Credits included
  - Shared Analysis Engine access
  - Limited Scan Capacity
  - Public Sessions Only
- **SecWeb3 Pro Plan**: 
  - US$15/month (US$180 billed annually)
  - 5000 Monthly Credits
  - Prioritized Scan Scheduling
  - Amplified Analysis Capacity
  - Private Sessions
- **Modern Pricing Modal**: Beautiful, responsive design with gradient styling and feature comparisons

### Fixed - Critical Backend Issues
- **Syntax Error Resolution**: Fixed duplicate `errorText` declaration causing server crashes
- **Message Validation**: Updated validation to accept any non-empty message content
- **Frontend-Backend Communication**: Fixed message field handling to send correct content
- **Timeout Removal**: Eliminated artificial 25-second timeouts for full streaming on Railway
- **API Format**: Corrected OpenPlayground API calls to use proper multipart/form-data format
- **Session Management**: Proper session creation and streaming flow implementation

### Fixed - UI/UX Improvements  
- **Credits Display**: Fixed header UI to show live credits balance instead of static "0"
- **Loading Messages**: Replaced "Connecting to AI service..." with cleaner "Initializing..."
- **Real-time Updates**: Credits now update immediately when deducted or refunded
- **Visual Feedback**: Added comprehensive notification system for credit changes
- **Responsive Design**: All new components work perfectly across desktop and mobile

### Enhanced - Code Quality & Architecture
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **State Management**: Improved real-time state updates for credits and user data
- **Component Architecture**: Clean separation of concerns with reusable components
- **API Integration**: Robust integration with external services and proper fallbacks
- **Performance**: Optimized streaming and reduced unnecessary API calls

## [2.1.0] - 2025-01-12

### Added - Credit System & Plan Management
- **Comprehensive Credit System**: Implemented usage-based credit system for scan operations
  - Dynamic cost calculation based on file size and language complexity
  - Language multipliers: Solidity (1.0x), Vyper (1.2x), Move (1.5x), Cairo (1.8x)
  - Real-time credit balance tracking and updates
  - Atomic credit deduction to prevent race conditions
- **Multi-Tier Plan System**: 
  - **Free Plan**: 100 credits, 50 credits/scan limit, 5 files/scan
  - **Pro Plan**: 1000 monthly credits, 200 credits/scan limit, 20 files/scan ($29/month)
  - **Custom Plan**: 5000+ monthly credits, 1000+ credits/scan limit, 100+ files/scan
- **Plan Management Features**:
  - Real-time cost estimation before scans
  - Plan upgrade request system with contact forms
  - Monthly credit reset for Pro/Custom plans
  - Plan-based feature restrictions and validation
- **Enhanced UI Components**:
  - Credit balance display in header with upgrade prompts
  - Cost estimation preview in code editor
  - Plans modal with detailed feature comparison
  - Upgrade request forms for Pro and Custom plans

### Added - Authentication & Security Improvements
- **Robust Web3 Authentication**:
  - Direct JWT implementation bypassing import dependencies
  - Consistent JWT secret management across modules
  - Enhanced signature verification with multiple message formats
  - Fallback user lookup mechanisms (by ID and wallet address)
- **Session Management**:
  - 24-hour session expiration with automatic renewal
  - Secure token storage with multiple key compatibility
  - Session invalidation on logout with database cleanup
- **Error Handling & Logging**:
  - Comprehensive debug endpoints for authentication testing
  - Detailed error messages for plan limit violations
  - Non-blocking credit estimation with graceful fallbacks
  - Enhanced middleware logging for troubleshooting

### Added - Database & Backend Enhancements
- **Plan System Database Schema**:
  - Plans table with detailed configuration (credits, limits, pricing, features)
  - Upgrade requests table for Pro/Custom plan inquiries
  - UUID/INTEGER compatibility for existing user systems
  - Foreign key constraints with proper error handling
- **Credit Management**:
  - Atomic credit deduction with row-level locking
  - Credit history tracking with timestamps
  - Monthly credit reset automation for subscription plans
  - Plan validation middleware for scan operations
- **API Endpoints**:
  - `/api/plans/current` - Get user's current plan and credit balance
  - `/api/plans/estimate-cost` - Real-time scan cost estimation
  - `/api/plans/upgrade-request` - Submit plan upgrade requests
  - `/api/plans` - List all available plans with features

### Enhanced - User Experience
- **Smart Contract Analysis**:
  - Credit cost preview before scan execution
  - Plan-aware scan limitations with upgrade prompts
  - Non-blocking analysis flow with credit validation
  - Enhanced error messages for insufficient credits/plan limits
- **Responsive Design**:
  - Mobile-optimized credit display and plan selection
  - Improved cost estimation UI in code editor
  - Streamlined upgrade process with progress indicators
- **Performance Optimizations**:
  - Throttled streaming message updates (300ms intervals)
  - Memoized chat components to prevent unnecessary re-renders
  - Optimized scroll behavior with conditional updates
  - Reduced API calls with intelligent caching

### Fixed - Critical Issues
- **Authentication Flow**:
  - Resolved 403 Forbidden errors on authenticated endpoints
  - Fixed JWT token verification with consistent secrets
  - Eliminated import path conflicts causing module loading failures
  - Corrected token storage/retrieval with proper key management
- **UI Stability**:
  - Fixed chat interface flickering and excessive scrolling
  - Resolved streaming message update loops causing performance issues
  - Eliminated missing function errors in dynamic imports
  - Fixed credit estimation blocking scan operations
- **Database Compatibility**:
  - Resolved UUID vs INTEGER foreign key conflicts
  - Fixed plan assignment for new user creation
  - Corrected database schema migrations with proper error handling
  - Enhanced user lookup with fallback mechanisms

### Changed - Architecture Improvements
- **Modular Authentication**: Restructured auth system with direct implementations to avoid dependency issues
- **Credit System Integration**: Layered credit validation into existing scan flow without breaking core functionality
- **Error-Resistant Design**: Implemented comprehensive fallback mechanisms for all critical operations
- **API Response Structure**: Standardized error responses with detailed plan/credit information

### Security Enhancements
- **JWT Token Security**: Enhanced token validation with expiration handling and format verification
- **Input Validation**: Strengthened file upload validation and content sanitization
- **Rate Limiting**: Implemented credit-based usage controls with plan enforcement
- **Session Security**: Improved session management with automatic cleanup and renewal

### Developer Experience
- **Debug Tools**: Added comprehensive debug endpoints for authentication and plan testing
- **Error Logging**: Enhanced logging with detailed error context and resolution hints
- **Documentation**: Updated API documentation with credit system endpoints and examples
- **Testing**: Added authentication flow testing and credit system validation

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
