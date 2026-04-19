# ReviewApp API Contract (auto-generated)

> Generated 2026-04-19T08:03:41.488Z — do not hand-edit. Run `bun infra/scripts/extract-api-contract.ts > docs/api-contract.md`.

Base: `https://review-api.teczeed.com`  (dev)

Auth: bearer JWT via `Authorization: Bearer <accessToken>` returned by `POST /api/v1/auth/login` or `/auth/exchange`.

---

## `auth` — mount `/api/v1/auth`

### POST `/api/v1/auth/register` _(authRateLimit)_
Handler: `controller.register`

- **validateBody** `registerSchema`
  ```ts
  z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    role: z.enum(['individual', 'recruiter', 'employer']),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format').optional(),
    firebaseToken: z.string().min(1, 'Firebase token is required'),
    industry: z.string().max(100).optional(),
    organizationName: z.string().max(200).optional(),
  })
  ```

### POST `/api/v1/auth/exchange-token` _(authRateLimit)_
Handler: `controller.exchangeToken`

- **validateBody** `exchangeFirebaseTokenSchema`
  ```ts
  z
    .object({
      firebaseToken: z.string().min(1).optional(),
      firebaseIdToken: z.string().min(1).optional(),
    })
    .refine((v) => Boolean(v.firebaseToken || v.firebaseIdToken), {
      message: 'firebaseIdToken (or firebaseToken) is required',
      path: ['firebaseIdToken'],
    })
    .transform((v) => ({
      firebaseToken: v.firebaseToken ?? v.firebaseIdToken!,
    }))
  ```

### POST `/api/v1/auth/login` _(authRateLimit)_
Handler: `controller.passwordLogin`

- **validateBody** `passwordLoginSchema`
  ```ts
  z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  ```

### GET `/api/v1/auth/me` _(authenticate)_
Handler: `controller.me`

### POST `/api/v1/auth/logout` _(authenticate)_
Handler: `controller.logout`

### POST `/api/v1/auth/role-request` _(authenticate)_
Handler: `controller.requestRoleUpgrade`

- **validateBody** `roleRequestSchema`
  ```ts
  z.object({
    requestedRole: z.enum(['EMPLOYER', 'RECRUITER']),
    companyName: z.string().min(1, 'Company name is required').max(255),
    companyWebsite: z.string().min(1, 'Company website is required').max(255),
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
  })
  ```

### GET `/api/v1/auth/role-request/me` _(authenticate)_
Handler: `controller.getMyRoleRequest`

### POST `/api/v1/auth/admin/create-user` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.createUser`

- **validateBody** `createUserSchema`
  ```ts
  z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    role: z.enum(['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN']),
  })
  ```

### GET `/api/v1/auth/admin/role-requests` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.listRoleRequests`

### POST `/api/v1/auth/admin/role-requests/:id/approve` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.approveRoleRequest`

- **validateParams** `roleRequestIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid('Invalid role request ID'),
  })
  ```

### POST `/api/v1/auth/admin/role-requests/:id/reject` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.rejectRoleRequest`

- **validateParams** `roleRequestIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid('Invalid role request ID'),
  })
  ```

### GET `/api/v1/auth/admin/users` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.listUsers`

### PATCH `/api/v1/auth/admin/users/:id/role` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.updateUserRole`

- **validateParams** `userIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid('Invalid user ID'),
  })
  ```
- **validateBody** `updateRoleSchema`
  ```ts
  z.object({
    role: z.enum(['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN']),
  })
  ```

### PATCH `/api/v1/auth/admin/users/:id/status` _(authenticate, requireRole(ADMIN_ROLES))_
Handler: `controller.updateUserStatus`

- **validateParams** `userIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid('Invalid user ID'),
  })
  ```
- **validateBody** `updateStatusSchema`
  ```ts
  z.object({
    status: z.enum(['active', 'suspended']),
  })
  ```

---

## `employer` — mount `/api/v1/employer`

Router-level middleware: `authenticate → requireRole(EMPLOYER|ADMIN)`

### GET `/api/v1/employer/dashboard` _(authenticate, requireRole(EMPLOYER|ADMIN))_
Handler: `controller.getDashboard`

- **validateQuery** `dashboardQuerySchema`
  ```ts
  z.object({
    period: z.coerce.number().int().min(7).max(365).default(30),
    groupBy: z.enum(['location']).optional(),
  })
  ```

### GET `/api/v1/employer/team` _(authenticate, requireRole(EMPLOYER|ADMIN))_
Handler: `controller.getTeam`

- **validateQuery** `teamQuerySchema`
  ```ts
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['compositeScore', 'totalReviews', 'displayName']).default('compositeScore'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  ```

### GET `/api/v1/employer/team/top` _(authenticate, requireRole(EMPLOYER|ADMIN))_
Handler: `controller.getTopPerformers`

### GET `/api/v1/employer/team/retention` _(authenticate, requireRole(EMPLOYER|ADMIN))_
Handler: `controller.getRetentionSignals`

### GET `/api/v1/employer/team/:profileId` _(authenticate, requireRole(EMPLOYER|ADMIN))_
Handler: `controller.getTeamMember`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid(),
  })
  ```

---

## `media` — mount `/api/v1/media`

### POST `/api/v1/media/upload`
Handler: `controller.upload`

- **validateBody** `uploadMediaSchema`
  ```ts
  z.object({
    reviewToken: z.string().uuid(),
    reviewId: z.string().uuid(),
    mediaType: z.enum(['text', 'voice', 'video']),
    textContent: z.string().max(280).optional(),
  })
  ```

### GET `/api/v1/media/:mediaId`
Handler: `controller.stream`

- **validateParams** `mediaIdParamSchema`
  ```ts
  z.object({
    mediaId: z.string().uuid(),
  })
  ```

### GET `/api/v1/media/:mediaId/signed-url`
Handler: `controller.getSignedUrl`

- **validateParams** `mediaIdParamSchema`
  ```ts
  z.object({
    mediaId: z.string().uuid(),
  })
  ```

---

## `organization` — mount `/api/v1/organizations`

Router-level middleware: `authenticate`

### POST `/api/v1/organizations/` _(authenticate)_
Handler: `controller.create`

- **validateBody** `createOrgSchema`
  ```ts
  z.object({
    name: z.string().min(2).max(200),
    industry: z.string().max(100),
    website: z.string().url().optional(),
    location: z.object({
      city: z.string().max(100),
      state: z.string().max(100).optional(),
      country: z.string().length(2),
    }),
    size: z.enum(['1-25', '26-100', '101-500', '500+']).optional(),
  })
  ```

### POST `/api/v1/organizations/tag` _(authenticate)_
Handler: `controller.tag`

- **validateBody** `tagSchema`
  ```ts
  z.object({
    profileId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
    role: z.string().max(100),
  })
  ```

### DELETE `/api/v1/organizations/untag/:profileOrgId` _(authenticate)_
Handler: `controller.untag`

- **validateParams** `profileOrgIdParamSchema`
  ```ts
  z.object({
    profileOrgId: z.string().uuid(),
  })
  ```

### GET `/api/v1/organizations/profile/:profileId` _(authenticate)_
Handler: `controller.getByProfile`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid(),
  })
  ```

### GET `/api/v1/organizations/me/team` _(authenticate, requireRole(['EMPLOYER']))_
Handler: `controller.getTeam`

- **validateQuery** `teamQuerySchema`
  ```ts
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    sortBy: z.enum(['name', 'reviewCount', 'qualityScore']).default('name'),
    quality: z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']).optional(),
  })
  ```

### GET `/api/v1/organizations/:id/members` _(authenticate)_
Handler: `controller.getMembers`

- **validateParams** `orgIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid(),
  })
  ```

### GET `/api/v1/organizations/:id` _(authenticate)_
Handler: `controller.getById`

- **validateParams** `orgIdParamSchema`
  ```ts
  z.object({
    id: z.string().uuid(),
  })
  ```

---

## `profile` — mount `/api/v1/profiles`

### POST `/api/v1/profiles/` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.create`

- **validateBody** `createProfileSchema`
  ```ts
  z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    photo: z.string().url('Photo must be a valid URL').optional(),
    industry: z.string().max(100).optional(),
    role: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    visibility: z.enum(['private', 'employer', 'recruiter', 'public']).default('private'),
  })
  ```

### GET `/api/v1/profiles/me` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.getOwn`

### PUT `/api/v1/profiles/me` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.update`

- **validateBody** `updateProfileSchema`
  ```ts
  z.object({
    name: z.string().min(2).max(100).optional(),
    photo: z.string().url().optional(),
    industry: z.string().max(100).optional(),
    role: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
  })
  ```

### PATCH `/api/v1/profiles/me/visibility` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.updateVisibility`

- **validateBody** `visibilitySchema`
  ```ts
  z.object({
    visibility: z.enum(['private', 'employer', 'recruiter', 'public']),
  })
  ```

### GET `/api/v1/profiles/me/qr` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.getQrCode`

- **validateQuery** `qrQuerySchema`
  ```ts
  z.object({
    format: z.enum(['png', 'svg']).default('png'),
    size: z.coerce.number().min(200).max(1200).default(300),
  })
  ```

### GET `/api/v1/profiles/me/stats` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.getStats`

- **validateQuery** `statsQuerySchema`
  ```ts
  z.object({
    period: z.enum(['7d', '30d', '90d', '12m', 'all']).default('all'),
  })
  ```

### GET `/api/v1/profiles/:slug`
Handler: `controller.getBySlug`

- **validateParams** `slugParamSchema`
  ```ts
  z.object({
    slug: z.string().min(4).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  })
  ```

---

## `quality` — mount `/api/v1/qualities`

### GET `/api/v1/qualities/`
Handler: `controller.list`

### GET `/api/v1/qualities/profile/:profileId`
Handler: `controller.getScoresByProfile`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid('Profile ID must be a valid UUID'),
  })
  ```

---

## `recruiter` — mount `/api/v1/recruiter`

Router-level middleware: `authenticate → requireRole(RECRUITER|ADMIN)`

### POST `/api/v1/recruiter/search` _(authenticate, requireRole(RECRUITER|ADMIN))_
Handler: `controller.search`

- **validateBody** `searchSchema`
  ```ts
  z.object({
    query: z.string().max(200).optional(),
    industries: z.array(z.string().max(100)).optional(),
    location: z.string().max(200).optional(),
    qualities: z.array(z.object({
      quality: qualityEnum,
      minPercentage: z.number().min(0).max(100),
    })).optional(),
    minReviewCount: z.coerce.number().int().min(0).optional(),
    activeInLastMonths: z.coerce.number().int().min(1).max(24).optional(),
    minVerifiedRate: z.coerce.number().min(0).max(100).optional(),
    hasVideo: z.boolean().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  ```

### GET `/api/v1/recruiter/profile/:profileId` _(authenticate, requireRole(RECRUITER|ADMIN))_
Handler: `controller.viewProfile`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid(),
  })
  ```

### POST `/api/v1/recruiter/contact/:profileId` _(authenticate, requireRole(RECRUITER|ADMIN))_
Handler: `controller.requestContact`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid(),
  })
  ```
- **validateBody** `contactRequestSchema`
  ```ts
  z.object({
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    hiringRole: z.string().min(1).max(200),
    companyName: z.string().min(1).max(200),
  })
  ```

### GET `/api/v1/recruiter/history` _(authenticate, requireRole(RECRUITER|ADMIN))_
Handler: `controller.getHistory`

---

## `reference` — mount `/api/v1/references`

### POST `/api/v1/references/opt-in`
Handler: `controller.optIn`

- **validateBody** `optInSchema`
  ```ts
  z.object({
    reviewId: z.string().uuid(),
    reviewerPhoneHash: z.string().min(64).max(128),
  })
  ```

### DELETE `/api/v1/references/withdraw/:referenceId`
Handler: `controller.withdraw`

- **validateParams** `referenceIdParamSchema`
  ```ts
  z.object({
    referenceId: z.string().uuid(),
  })
  ```

### POST `/api/v1/references/request` _(authenticate, requireRole(['RECRUITER']))_
Handler: `controller.requestContact`

- **validateBody** `contactRequestSchema`
  ```ts
  z.object({
    referenceId: z.string().uuid(),
    companyName: z.string().min(1).max(200),
    roleTitle: z.string().min(1).max(200),
    message: z.string().min(1).max(300),
  })
  ```

### GET `/api/v1/references/profile/:profileId`
Handler: `controller.getByProfile`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid(),
  })
  ```

---

## `review` — mount `/api/v1/reviews`

### POST `/api/v1/reviews/scan/:slug` _(reviewRateLimit)_
Handler: `controller.scan`

- **validateParams** `slugParamSchema`
  ```ts
  z.object({
    slug: z.string().min(4).max(50),
  })
  ```
- **validateBody** `scanSchema`
  ```ts
  z.object({
    deviceFingerprint: z.string().min(16).max(128).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    userAgent: z.string().max(500).optional(),
  })
  ```

### POST `/api/v1/reviews/submit` _(reviewRateLimit)_
Handler: `controller.submit`

- **validateBody** `submitReviewSchema`
  ```ts
  z.object({
    reviewToken: z.string().uuid('Review token must be a valid UUID'),
    qualities: z.array(qualityEnum).min(1, 'At least 1 quality pick is required').max(2, 'Maximum 2 quality picks allowed'),
    qualityDisplayOrder: z.array(qualityEnum).length(5, 'Must include all 5 qualities in display order'),
    thumbsUp: z.literal(true, { errorMap: () => ({ message: 'Thumbs up is required' }) }),
    phoneHash: z.string().min(16).optional(),
    optInVerifiable: z.boolean().default(false),
  })
  ```

### GET `/api/v1/reviews/my-submissions`
Handler: `controller.mySubmissions`

### GET `/api/v1/reviews/me` _(authenticate, requireRole(['INDIVIDUAL']))_
Handler: `controller.getMyReviews`

- **validateQuery** `reviewsQuerySchema`
  ```ts
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    quality: qualityEnum.optional(),
    mediaType: z.enum(['text', 'voice', 'video']).optional(),
    badgeTier: z.enum(['basic', 'verified', 'verified_interaction', 'verified_testimonial']).optional(),
    sortBy: z.enum(['recent', 'badgeTier']).default('recent'),
  })
  ```

### GET `/api/v1/reviews/profile/:profileId`
Handler: `controller.getByProfile`

- **validateParams** `profileIdParamSchema`
  ```ts
  z.object({
    profileId: z.string().uuid('Profile ID must be a valid UUID'),
  })
  ```
- **validateQuery** `reviewsQuerySchema`
  ```ts
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    quality: qualityEnum.optional(),
    mediaType: z.enum(['text', 'voice', 'video']).optional(),
    badgeTier: z.enum(['basic', 'verified', 'verified_interaction', 'verified_testimonial']).optional(),
    sortBy: z.enum(['recent', 'badgeTier']).default('recent'),
  })
  ```

---

## `subscription` — mount `/api/v1/subscriptions`

### POST `/api/v1/subscriptions/webhook`
Handler: `controller.handleWebhook`

### POST `/api/v1/subscriptions/checkout`
Handler: `controller.checkout`

- **validateBody** `createCheckoutSchema`
  ```ts
  z.object({
    tier: z.enum([
      'pro_individual',
      'employer_small',
      'employer_medium',
      'employer_large',
      'recruiter_basic',
      'recruiter_premium',
    ]),
    billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    locationCount: z.coerce.number().int().min(1).optional(),
    seatCount: z.coerce.number().int().min(1).optional(),
  })
  ```

### GET `/api/v1/subscriptions/me`
Handler: `controller.getMe`

### POST `/api/v1/subscriptions/cancel`
Handler: `controller.cancel`

- **validateBody** `cancelSchema`
  ```ts
  z.object({
    immediate: z.boolean().default(false),
  })
  ```

---

## `verification` — mount `/api/v1/verification`

### POST `/api/v1/verification/initiate`
Handler: `controller.initiate`

- **validateBody** `initiateSchema`
  ```ts
  z.object({
    slug: z.string().min(4).max(50),
    deviceFingerprint: z.string().min(16).max(128),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    gpsAccuracyMeters: z.number().min(0).optional(),
    userAgent: z.string().max(500).optional(),
  })
  ```

### POST `/api/v1/verification/otp/send`
Handler: `controller.sendOtp`

- **validateBody** `sendOtpSchema`
  ```ts
  z.object({
    reviewToken: z.string().uuid(),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
    channel: z.enum(['sms', 'whatsapp']).default('sms'),
  })
  ```

### POST `/api/v1/verification/otp/verify`
Handler: `controller.verifyOtp`

- **validateBody** `verifyOtpSchema`
  ```ts
  z.object({
    reviewToken: z.string().uuid(),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
    otp: z.string().length(6).regex(/^\d{6}$/),
  })
  ```

### GET `/api/v1/verification/token/:tokenId`
Handler: `controller.validateToken`

- **validateParams** `tokenIdParamSchema`
  ```ts
  z.object({
    tokenId: z.string().uuid(),
  })
  ```

---

