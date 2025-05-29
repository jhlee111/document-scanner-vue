# Document Scanner Vue - Playground

This is the development playground for the Document Scanner Vue component library.

## 🚀 Quick Start

From the root directory:

```bash
# Start development server
npm run dev
```

The playground will start at `http://localhost:3000` with hot reload enabled.

## 📱 Mobile Testing

The development server accepts external connections for mobile testing:

1. Find your computer's IP address
2. Access `http://YOUR_IP:3000` from your mobile device
3. Test camera functionality and touch interactions

## 🎯 Purpose

This playground serves as:

- **Development Environment**: Test component changes in real-time
- **Demo Application**: Showcase component functionality
- **Testing Ground**: Verify mobile compatibility and performance

## 🛠️ Features

- ✅ Hot reload for instant feedback
- ✅ Mobile-optimized testing
- ✅ Bootstrap UI for clean presentation
- ✅ Font Awesome icons
- ✅ OpenCV.js integration
- ✅ Real component import (not mocked)

## 📁 Structure

```
playground/
├── index.html      # HTML entry point
├── main.ts         # Vue app initialization
├── App.vue         # Main playground component
└── README.md       # This file
```

## 🔧 Customization

You can modify the playground to test different scenarios:

- Add multiple component instances
- Test different props and configurations
- Simulate various use cases
- Add custom styling for testing

## 🚀 Building for Production

The playground is for development only. To build the library:

```bash
npm run build
```

This creates the distributable library in the `dist/` folder. 