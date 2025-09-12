# MyPocket Reader: Authentication & Server-Side Storage Plan

## Overview

This document outlines the implementation plan for adding magic link authentication and server-side data storage to MyPocket Reader, transforming it from a client-only application to a full-stack solution with optional user accounts.

## Current Architecture

- **Framework**: Next.js 15 (App Router) with React 19
- **Data Storage**: localStorage (browser cache)
- **State Management**: React hooks
- **Main Component**: `pocket-importer.tsx` (2000+ lines, single large component)

## Planned Features

### 1. Magic Link Authentication System
### 2. Server-Side Storage for Authenticated Users
### 3. Data Migration Tool for Existing Users

## Implementation Decisions

### ✅ Confirmed Decisions

1. **Authentication System**: NextAuth.js (Auth.js v5)
   - Reason: Built for Next.js 15, native magic link support, handles security
   - Provider: Email provider for magic link functionality
   - Integration: Seamless with existing App Router architecture

2. **Data Migration**: Yes, build automatic migration tool
   - When: User decides to login for the first time
   - Process: localStorage data → server database
   - Fallback: Manual export/import as backup option

### 🔄 To Be Determined (TBD)

1. **Database Choice** (TBD)
   - **Option A**: PostgreSQL + Prisma (relational, type-safe ORM)
   - **Option B**: Supabase (PostgreSQL + Auth + Real-time, could replace NextAuth.js)
   - **Option C**: PlanetScale (serverless MySQL, excellent Vercel integration)
   - **Option D**: MongoDB + Mongoose (document-based, matches current JSON structure)

2. **User Experience Strategy** (TBD)
   - **Option A**: Optional authentication with local-only mode preserved
   - **Option B**: Encourage sign-up but maintain current anonymous functionality
   - **Option C**: Seamless transition from local to server storage
   - **Decision Factors**: User retention, privacy concerns, feature complexity

3. **Offline Support Strategy** (TBD)
   - **Option A**: Full offline-first with background sync
   - **Option B**: Online-required for authenticated users
   - **Option C**: Hybrid approach with smart caching
   - **Decision Factors**: Complexity vs. user experience, sync conflict resolution

## Technical Implementation Plan

### Phase 1: Authentication Foundation
**Estimated Time**: 1-2 weeks

#### 1.1 NextAuth.js Setup
```bash
npm install next-auth @auth/core
```

#### 1.2 Required Files
- `app/api/auth/[...nextauth]/route.ts` - Auth API routes
- `lib/auth.ts` - Auth configuration and providers
- `components/auth/` - Login/logout UI components
- `middleware.ts` - Route protection (if needed)

#### 1.3 Email Provider Configuration
- Magic link email templates
- SMTP configuration (SendGrid, Resend, or similar)
- Email verification flow

#### 1.4 Session Management
- Session provider integration in `app/layout.tsx`
- User session state in `pocket-importer.tsx`

### Phase 2: Database & API Layer
**Estimated Time**: 2-3 weeks

#### 2.1 Database Schema Design
```typescript
// Planned schema structure (exact implementation TBD)
User {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}

Article {
  id: string
  userId: string
  title: string
  url: string
  timeAdded: number
  tags: string
  status: "read" | "unread"
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}

Highlight {
  id: string
  articleId: string
  quote: string
  createdAt: number
}
```

#### 2.2 API Routes
- `app/api/user/articles/route.ts` - Articles CRUD
- `app/api/user/highlights/route.ts` - Highlights CRUD
- `app/api/user/sync/route.ts` - Data synchronization
- `app/api/user/export/route.ts` - Server-side export
- `app/api/user/migrate/route.ts` - Data migration from localStorage

#### 2.3 Data Validation
- Zod schemas for API request/response validation
- Type safety between client and server
- Data sanitization and security measures

### Phase 3: Data Migration & Sync
**Estimated Time**: 2-3 weeks

#### 3.1 Migration Tool
- Detect existing localStorage data
- Present migration options to user on first login
- Batch upload with progress indicators
- Conflict resolution strategies
- Rollback mechanisms

#### 3.2 Sync Strategy (Implementation TBD)
- Bidirectional sync between local and server
- Conflict resolution (last-write-wins vs. merge strategies)
- Optimistic updates with rollback capability
- Background sync mechanisms

#### 3.3 Backward Compatibility
- Maintain current localStorage functionality for anonymous users
- Graceful degradation when server is unavailable
- Clear migration path without data loss

### Phase 4: UI/UX Integration
**Estimated Time**: 1-2 weeks

#### 4.1 Authentication UI
- Login/logout components
- User profile/settings page
- Account status indicators
- Migration progress UI

#### 4.2 `pocket-importer.tsx` Modifications
- Detect authentication state
- Switch between local and server storage modes
- Add sync status indicators
- Handle loading states for server operations

#### 4.3 Enhanced Features (Post-MVP)
- Multi-device sync indicators
- Data usage/statistics
- Account management features
- Enhanced error handling and user feedback

## Technical Considerations

### Security
- Email-based authentication only (no passwords)
- CSRF protection via NextAuth.js
- API route protection with session validation
- Data encryption at rest (database-dependent)
- Rate limiting on auth endpoints

### Performance
- Pagination for large datasets (already implemented)
- Database indexing strategy
- Caching layers for frequently accessed data
- Background sync to avoid UI blocking

### Scalability
- Stateless API design
- Database connection pooling
- CDN for static assets (already on Vercel)
- Horizontal scaling capability

## Migration Strategy for Existing Users

### User Flow
1. User visits app (continues working as before)
2. User clicks "Sign In" or "Sync Data" button
3. Enter email address → receive magic link
4. Click magic link → authenticate and return to app
5. App detects localStorage data → prompt for migration
6. User confirms → automatic data upload with progress bar
7. Success confirmation → switch to server-backed storage

### Edge Cases
- Partial migration failures
- Large datasets (>10MB of articles)
- Network interruptions during migration
- Duplicate data handling
- Migration cancellation/retry

## Testing Strategy

### Unit Tests
- Authentication flow components
- API route handlers
- Data migration utilities
- Sync conflict resolution

### Integration Tests
- End-to-end authentication flow
- Data migration process
- Client-server sync operations
- Error recovery scenarios

### User Testing
- Anonymous user experience (unchanged)
- First-time login and migration
- Multi-device usage patterns
- Offline/online transitions (if implemented)

## Deployment Considerations

### Environment Variables
```env
NEXTAUTH_SECRET=
NEXTAUTH_URL=
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=
DATABASE_URL= (TBD based on database choice)
```

### Database Hosting
- Production database setup (provider TBD)
- Backup and recovery procedures
- Migration scripts for schema updates
- Performance monitoring

### Vercel Configuration
- Edge functions for auth (if beneficial)
- Database connection management
- Environment variable management
- Analytics and monitoring

## Success Metrics

### Technical Metrics
- Authentication success rate
- Migration completion rate
- API response times
- Database query performance
- Error rates and resolution time

### User Experience Metrics
- User adoption of authentication
- Data migration satisfaction
- Feature usage patterns
- Support ticket volume

## Risks & Mitigation

### Technical Risks
- **Large component refactoring**: Gradual migration, feature flags
- **Data loss during migration**: Comprehensive backups, rollback procedures
- **Performance degradation**: Load testing, optimization phases
- **Database vendor lock-in**: Abstraction layers, standardized queries

### User Experience Risks
- **Forcing authentication**: Keep anonymous mode available
- **Complex migration UX**: Simple, guided process with clear benefits
- **Data privacy concerns**: Clear privacy policy, data export options

## Next Steps

1. **Finalize TBD decisions** (database, UX strategy, offline support)
2. **Set up development environment** with chosen database
3. **Implement Phase 1** (NextAuth.js integration)
4. **Create database schema** and initial API routes
5. **Build migration tool** with comprehensive testing
6. **Gradual rollout** with feature flags and user feedback

## Questions for Future Discussion

1. Should we implement the database choice as a pluggable system to allow switching later?
2. What level of backward compatibility should we maintain for very old cached data?
3. Should we implement any collaborative features (shared collections) in the future?
4. How should we handle data exports for users who want to leave the service?
5. What analytics should we collect to measure success of the new features?

---

**Document Status**: Draft v1.0
**Last Updated**: 2025-09-06
**Next Review**: After TBD decisions are finalized
