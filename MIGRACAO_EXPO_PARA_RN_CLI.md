# Migração de Expo para React Native CLI

## Status da Migração

### ✅ Concluído
1. Código fonte (src/) migrado
2. Assets migrados
3. Configurações (tsconfig.json, babel.config.js, metro.config.js) atualizadas
4. package.json atualizado com dependências React Native CLI
5. Arquivo de configuração de ambiente criado (config/env.ts)
6. Substituições principais:
   - `expo-constants` → `@config/env`
   - `@clerk/clerk-expo` → `@clerk/clerk-react-native`
   - `expo-secure-store` → `@react-native-async-storage/async-storage`

### ⚠️ Pendente - Substituições Necessárias

#### 1. SQLite
- **Expo**: `expo-sqlite`
- **React Native CLI**: `react-native-sqlite-storage`
- **Arquivos afetados**:
  - `src/data/storage/sqlite.ts`
  - `src/data/storage/sqlite-test.ts`
  - `src/data/storage/test-sqlite.ts`
  - `src/data/storage/sqlite-wrapper.ts`

#### 2. File System
- **Expo**: `expo-file-system`
- **React Native CLI**: `react-native-fs`
- **Arquivos afetados**:
  - `src/services/logging/logger.ts`

#### 3. Sharing
- **Expo**: `expo-sharing`
- **React Native CLI**: `react-native-share`
- **Arquivos afetados**:
  - `src/services/logging/logger.ts`

#### 4. Video/Audio
- **Expo**: `expo-av`
- **React Native CLI**: `react-native-video` (para vídeo)
- **Arquivos afetados**:
  - `src/presentation/screens/VideoTutorial.tsx`

#### 5. Speech
- **Expo**: `expo-speech`
- **React Native CLI**: `@react-native-community/voice`
- **Arquivos afetados**: Verificar uso

#### 6. Intent Launcher (Android)
- **Expo**: `expo-intent-launcher`
- **React Native CLI**: `react-native-intent-launcher` ou `Linking` nativo
- **Arquivos afetados**:
  - `src/presentation/screens/HomeWip.tsx`

#### 7. OAuth/Web Browser
- **Expo**: `expo-auth-session`, `expo-web-browser`
- **React Native CLI**: Usar Clerk (já configurado) ou implementação customizada
- **Arquivos afetados**:
  - `src/services/auth/google-auth-service.ts`

#### 8. Ícones
- **Expo**: `@expo/vector-icons`
- **React Native CLI**: `react-native-vector-icons` ou `@expo/vector-icons` (ainda funciona)
- **Arquivos afetados**:
  - `src/presentation/screens/GoogleLoginScreen.tsx`

## Próximos Passos

1. Instalar dependências faltantes:
```bash
npm install react-native-sqlite-storage react-native-fs react-native-share react-native-video react-native-intent-launcher
```

2. Para iOS, executar:
```bash
cd ios && pod install && cd ..
```

3. Para Android, verificar se as permissões estão no AndroidManifest.xml

4. Testar build:
```bash
npm run android
npm run ios
```

## Notas Importantes

- O projeto usa Clerk para autenticação, então a maioria das funcionalidades de OAuth já está coberta
- Alguns módulos do Expo podem continuar funcionando (como @expo/vector-icons)
- Verificar compatibilidade de versões do React Native (0.82.1)

