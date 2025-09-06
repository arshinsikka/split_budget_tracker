# ADR-0002: Frontend Architecture and Design Decisions

## Status

Accepted

## Context

We need to implement a frontend for the Split Budget Tracker application that provides a user-friendly interface for managing shared expenses and settlements. The frontend should integrate seamlessly with the existing backend API while providing a modern, responsive user experience.

## Decision

We will implement a React-based frontend with the following architectural decisions:

### Technology Stack

- **React 18** with TypeScript for type safety and modern React features
- **Vite** as the build tool for fast development and optimized production builds
- **TailwindCSS** for utility-first styling and responsive design
- **React Router** for client-side navigation between pages
- **react-hot-toast** for user feedback notifications

### Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Dashboard.tsx    # Main dashboard with user balances
│   │   ├── Transactions.tsx # Transaction management
│   │   ├── Settle.tsx      # Settlement form
│   │   ├── Navigation.tsx  # Top navigation bar
│   │   ├── ErrorBoundary.tsx # Error handling
│   │   └── HealthCheck.tsx # Backend connectivity
│   ├── lib/
│   │   └── api.ts          # API client with error handling
│   ├── App.tsx             # Main app with routing
│   └── main.tsx           # React entry point
├── scripts/
│   └── demo-ui.sh         # Full-stack demo script
└── package.json           # Dependencies and scripts
```

### API Client Design

- **Centralized API Client**: Single `api.ts` file with all backend interactions
- **TypeScript Interfaces**: Full type safety for all API requests and responses
- **RFC 7807 Error Handling**: Consistent error handling with Problem Details format
- **Custom Error Classes**: `APIError` class for structured error handling
- **Idempotency Support**: Built-in support for idempotency keys in POST requests

### State Management

- **Local Component State**: Use React hooks for component-level state
- **No Global State**: Avoid complex state management for this simple application
- **Manual Refresh**: Users can refresh data manually via refresh buttons
- **Future Consideration**: Global state management (Redux/Zustand) can be added later if needed

### Error Handling Strategy

- **Error Boundary**: App-level error boundary catches JavaScript errors
- **Toast Notifications**: User-friendly error messages via react-hot-toast
- **Form Validation**: Client-side validation with inline error messages
- **Loading States**: Skeleton animations and disabled states during API calls
- **Graceful Degradation**: App continues to function even when backend is unavailable

### UI/UX Design Principles

- **Minimal Design**: Clean, professional interface without unnecessary complexity
- **Responsive Layout**: Works on desktop and mobile devices
- **Accessibility**: Keyboard navigation, focus styles, semantic HTML
- **Consistent Styling**: TailwindCSS utility classes for consistent design
- **Loading Feedback**: Skeleton animations and spinners for better UX

### Navigation and Routing

- **Three Main Pages**: Dashboard, Transactions, Settle
- **Top Navigation**: Persistent navigation bar with active route highlighting
- **Client-side Routing**: React Router for smooth page transitions
- **URL-based Navigation**: Each page has its own URL for bookmarking

### Form Handling

- **Controlled Components**: All form inputs use controlled components
- **Real-time Validation**: Immediate feedback on form errors
- **Double-submit Protection**: Disabled submit buttons during processing
- **Success Feedback**: Toast notifications and automatic form clearing
- **Idempotency Keys**: Generated automatically to prevent duplicate submissions

### Currency and Data Formatting

- **SGD Currency**: All amounts displayed in Singapore Dollars
- **2 Decimal Places**: Consistent formatting with `Intl.NumberFormat`
- **Date Formatting**: Singapore locale for date and time display
- **Type Badges**: Color-coded badges for transaction types

### Development and Build Process

- **Environment Variables**: Vite's `import.meta.env` for configuration
- **TypeScript Configuration**: Strict type checking with Vite client types
- **Build Optimization**: Vite's optimized production builds
- **Development Server**: Hot module replacement for fast development

## Consequences

### Positive

- **Type Safety**: TypeScript prevents runtime errors and improves developer experience
- **Fast Development**: Vite provides instant hot reload and fast builds
- **Consistent Design**: TailwindCSS ensures consistent styling across components
- **User-Friendly**: Toast notifications and loading states improve user experience
- **Maintainable**: Clear project structure and separation of concerns
- **Responsive**: Works well on all device sizes
- **Accessible**: Basic accessibility features built-in

### Negative

- **No Global State**: Manual refresh required for cross-page data updates
- **Bundle Size**: React and dependencies add to bundle size
- **Complexity**: More complex than a simple HTML/CSS solution
- **Learning Curve**: Developers need to understand React and TypeScript

### Risks

- **Backend Dependency**: Frontend requires backend API to function properly
- **Browser Compatibility**: Modern JavaScript features may not work in older browsers
- **State Synchronization**: Manual refresh may lead to stale data

## Alternatives Considered

### Alternative 1: Vanilla HTML/CSS/JavaScript

- **Pros**: Simple, lightweight, no build process
- **Cons**: No type safety, harder to maintain, limited interactivity

### Alternative 2: Vue.js

- **Pros**: Simpler than React, good TypeScript support
- **Cons**: Smaller ecosystem, less familiar to most developers

### Alternative 3: Next.js

- **Pros**: Full-stack framework, SSR capabilities
- **Cons**: Overkill for this simple application, more complex setup

### Alternative 4: Global State Management (Redux/Zustand)

- **Pros**: Automatic data synchronization across pages
- **Cons**: Added complexity, learning curve, not needed for simple app

## Implementation Notes

- All components use functional components with hooks
- Error boundary catches errors in child components
- API client handles all HTTP requests with consistent error handling
- Forms use controlled components with real-time validation
- Loading states use skeleton animations and spinners
- Currency formatting uses `Intl.NumberFormat` for consistency

## Future Considerations

- **Global State**: Consider adding Redux or Zustand if app grows more complex
- **Testing**: Add unit tests with Vitest and integration tests with React Testing Library
- **PWA Features**: Add service worker for offline functionality
- **Internationalization**: Add i18n support for multiple languages
- **Performance**: Add code splitting and lazy loading for larger apps
- **Monitoring**: Add error tracking and performance monitoring

## References

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [React Router Documentation](https://reactrouter.com/)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
