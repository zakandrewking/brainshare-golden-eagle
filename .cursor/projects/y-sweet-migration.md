# Y-sweet Self-Hosting Migration Project Plan

## Project Overview
Implement self-hosted Y-sweet as an alternative backend option alongside Liveblocks, enabling more control over the real-time collaboration infrastructure while maintaining existing functionality. The Y-sweet server will be deployed on Render.

## Current State Analysis
- Using Liveblocks for real-time collaboration
- Yjs as the underlying CRDT implementation
- Next.js frontend with TypeScript
- Supabase for database
- Current features:
  - Real-time collaborative tables
  - Document management
  - User presence and awareness
  - Cursor tracking
  - Document forking

## Goals
- [x] Deploy Y-sweet server on Render
- [ ] Create abstraction layer to support both Liveblocks and Y-sweet
- [ ] Implement secure WebSocket connections
- [ ] Maintain all current functionality
- [ ] Enable easy switching between backends

## Phase 1: Render Deployment Setup (1 week)

### 1.1 Render Configuration

- [x] Create Render account and project (see `yjs/README.md`)

### 1.2 Y-sweet Configuration

```typescript
interface YSweetConfig {
  port: number;
  host: string;
  ssl: {
    enabled: boolean;
  };
  storage: {
    type: 'redis';
    config: {
      url: string;
    };
  };
  auth: {
    enabled: boolean;
    jwtSecret: string;
  };
}
```

## Phase 2: Backend Abstraction Layer (2-3 weeks)

### 2.1 Create Backend Interface
```typescript
interface CollaborationBackend {
  // Room Management
  createRoom(roomId: string, options: RoomOptions): Promise<RoomData>;
  deleteRoom(roomId: string): Promise<void>;
  getRooms(): Promise<RoomData[]>;

  // Document Operations
  getYjsDocument(roomId: string): Promise<ArrayBuffer>;
  sendYjsUpdate(roomId: string, update: Uint8Array): Promise<void>;

  // Presence & Awareness
  updatePresence(roomId: string, presence: any): Promise<void>;
  getPresence(roomId: string): Promise<Map<number, any>>;

  // Connection Management
  connect(roomId: string): Promise<void>;
  disconnect(roomId: string): Promise<void>;
}
```

### 2.2 Implement Backend Adapters
```typescript
class YSweetBackend implements CollaborationBackend {
  private ws: WebSocket;
  private config: YSweetConfig;

  constructor(config: YSweetConfig) {
    this.config = config;
  }

  async connect(roomId: string): Promise<void> {
    const wsUrl = `wss://${this.config.host}/ws/${roomId}`;
    this.ws = new WebSocket(wsUrl);
    // Implement connection handling
  }

  // Implement other interface methods
}

class LiveblocksBackend implements CollaborationBackend {
  // Existing Liveblocks implementation
}
```

## Phase 3: Frontend Integration (2-3 weeks)

### 3.1 Update Provider Components
```typescript
const CollaborationProvider: React.FC<{
  backend: CollaborationBackend;
  roomId: string;
  children: React.ReactNode;
}> = ({ backend, roomId, children }) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      await backend.connect(roomId);
      setConnected(true);
    };
    connect();
    return () => backend.disconnect(roomId);
  }, [backend, roomId]);

  if (!connected) return <LoadingSpinner />;
  return <>{children}</>;
};
```

### 3.2 Update Store Management
- [ ] Modify awareness store to work with both backends
- [ ] Update cursor tracking implementation
- [ ] Adapt real-time event handling

## Phase 4: Security and Performance (2 weeks)

### 4.1 Security Implementation
- [ ] Implement JWT authentication
- [ ] Set up rate limiting in Render
- [ ] Configure CORS
- [ ] Implement request validation

### 4.2 Performance Optimization
- [ ] Configure Render auto-scaling
- [ ] Set up caching
- [ ] Optimize WebSocket message handling
- [ ] Configure load balancing in Render

## Phase 5: Testing and Validation (2 weeks)

### 5.1 Testing Infrastructure
- [ ] Create backend-specific test suites
- [ ] Implement integration tests
- [ ] Add performance benchmarks
- [ ] Create migration tests

### 5.2 Validation
- [ ] Feature parity verification
- [ ] Performance comparison
- [ ] Security audit
- [ ] User experience validation

## Technical Implementation Details

### Render Service Configuration
```yaml
# render.yaml
services:
  - type: web
    name: y-sweet
    env: docker
    image: y-sweet/server:latest
    plan: standard
    envVars:
      - key: YSWEET_PORT
        value: 8080
      - key: YSWEET_HOST
        sync: false
      - key: YSWEET_STORAGE_TYPE
        value: redis
      - key: YSWEET_REDIS_URL
        fromService:
          type: redis
          name: y-sweet-redis
          property: connectionString
      - key: YSWEET_JWT_SECRET
        sync: false
    healthCheckPath: /health
    autoDeploy: true

  - type: redis
    name: y-sweet-redis
    plan: standard
```

### Backend Configuration
```typescript
// Example configuration
const backendConfig = {
  type: process.env.COLLABORATION_BACKEND || 'liveblocks',
  ySweet: {
    host: process.env.YSWEET_HOST,
    port: parseInt(process.env.YSWEET_PORT || '8080'),
    ssl: {
      enabled: true, // Always enabled on Render
    },
    auth: {
      enabled: process.env.YSWEET_AUTH === 'true',
      jwtSecret: process.env.YSWEET_JWT_SECRET,
    },
  },
  liveblocks: {
    // Existing Liveblocks configuration
  },
};
```

### Document Migration
```typescript
async function migrateDocument(
  sourceBackend: CollaborationBackend,
  targetBackend: CollaborationBackend,
  roomId: string
): Promise<MigrationResult> {
  try {
    // 1. Get document data from source
    const documentData = await sourceBackend.getYjsDocument(roomId);

    // 2. Create new document in target
    const newRoom = await targetBackend.createRoom(roomId, {
      metadata: {
        name: roomId,
        type: 'table'
      }
    });

    // 3. Transfer data
    await targetBackend.sendYjsUpdate(newRoom.id, documentData);

    return { success: true, newRoomId: newRoom.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Risk Mitigation

1. **Render Service Reliability**
   - Monitor Render service health
   - Set up alerts for service issues
   - Implement automatic failover
   - Regular backup of Redis data

2. **Security**
   - Regular security audits
   - Implement rate limiting in Render
   - Monitor for suspicious activity
   - Keep dependencies updated

3. **Performance**
   - Monitor Render service metrics
   - Configure auto-scaling
   - Optimize Redis usage
   - Implement caching strategies

## Timeline and Resources

- Total estimated time: 7-10 weeks
- Required resources:
  - 2-3 developers
  - 1 DevOps engineer
  - 1 QA engineer
  - Project manager

## Success Criteria

1. Y-sweet server running reliably on Render
2. Both backends fully functional
3. Seamless switching between backends
4. No data loss during migration
5. Comparable performance between backends
6. Clear documentation for both options

## Next Steps

1. Review and approve this project plan
2. Set up Render account and project
3. Begin Phase 1 with Render deployment
4. Create detailed technical specifications for each phase
