# stacks/flutter.md — Flutter Stack Addendum

> Extends the base handbook for Flutter (iOS + Android + Web) projects.
> Read after the base handbook files during bootstrap.

---

## Approved Versions

- Flutter: stable channel, latest (check `flutter --version`)
- Dart: bundled with Flutter
- Lock exact Flutter version in `fvm` or `.fvmrc`

```bash
# Use Flutter Version Management (fvm)
fvm install 3.24.0  # or latest stable
fvm use 3.24.0
# Commit .fvmrc — all team members and CI use the same Flutter version
```

---

## Required `pubspec.yaml` Setup

```yaml
name: {{PROJECT_SLUG}}
description: {{PROJECT_DESCRIPTION}}
version: 1.0.0+1

environment:
  sdk: '>=3.4.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0

  # Navigation
  go_router: ^14.0.0

  # Network
  dio: ^5.4.0
  retrofit: ^4.1.0  # Type-safe HTTP client generator

  # Models
  freezed_annotation: ^2.4.0
  json_annotation: ^4.9.0

  # Local storage
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.0.0

  # Firebase (only if using Firebase)
  firebase_core: ^3.0.0
  firebase_auth: ^5.0.0
  cloud_firestore: ^5.0.0
  firebase_storage: ^12.0.0
  firebase_analytics: ^11.0.0
  firebase_crashlytics: ^4.0.0

  # Utilities
  intl: ^0.19.0
  logger: ^2.3.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  very_good_analysis: ^6.0.0
  build_runner: ^2.4.0
  freezed: ^2.5.0
  json_serializable: ^6.8.0
  riverpod_generator: ^2.4.0
  go_router_builder: ^2.7.0
  integration_test:
    sdk: flutter
  golden_toolkit: ^0.15.0
```

---

## Analysis Options (Strict Linting)

```yaml
# analysis_options.yaml
include: package:very_good_analysis/analysis_options.yaml

analyzer:
  exclude:
    - "**/*.g.dart"       # Generated files
    - "**/*.freezed.dart"
    - "lib/generated/**"
  errors:
    missing_required_param: error
    missing_return: error
  language:
    strict-casts: true
    strict-inference: true
    strict-raw-types: true

linter:
  rules:
    always_use_package_imports: true
    avoid_dynamic_calls: true
    avoid_slow_async_io: true
    no_adjacent_strings_in_list: true
    prefer_const_constructors: true
    prefer_const_declarations: true
    prefer_final_locals: true
```

---

## App Architecture Pattern

This organisation uses **Clean Architecture** for Flutter:

```
domain/          ← Business logic, no Flutter dependencies
  entities/      ← Plain Dart objects (immutable via freezed)
  repositories/  ← Abstract interfaces
  usecases/      ← Single-responsibility business operations

data/            ← Infrastructure, implements domain
  models/        ← JSON-serialisable versions of entities
  datasources/   ← Firebase, Supabase, REST, local DB
  repositories/  ← Concrete repository implementations

presentation/    ← Flutter UI, reads from domain
  pages/         ← Screens
  widgets/       ← Reusable components
  providers/     ← Riverpod providers (bridge domain ↔ UI)
```

### Entity Example (Immutable via Freezed)
```dart
// domain/entities/order.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'order.freezed.dart';

@freezed
class Order with _$Order {
  const factory Order({
    required String id,
    required String userId,
    required List<OrderItem> items,
    required OrderStatus status,
    required Money total,
    required DateTime createdAt,
  }) = _Order;
}

enum OrderStatus { pending, confirmed, shipped, delivered, cancelled }
```

### Repository Pattern
```dart
// domain/repositories/order_repository.dart
abstract class OrderRepository {
  Future<Either<Failure, List<Order>>> getUserOrders(String userId);
  Future<Either<Failure, Order>> getOrder(String orderId);
  Future<Either<Failure, Order>> createOrder(CreateOrderParams params);
}

// data/repositories/firebase_order_repository.dart
class FirebaseOrderRepository implements OrderRepository {
  final FirebaseFirestore _firestore;
  FirebaseOrderRepository(this._firestore);

  @override
  Future<Either<Failure, List<Order>>> getUserOrders(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('orders')
          .where('userId', isEqualTo: userId)
          .orderBy('createdAt', descending: true)
          .get();
      
      return Right(snapshot.docs.map((doc) {
        return OrderModel.fromJson({...doc.data(), 'id': doc.id}).toEntity();
      }).toList());
    } on FirebaseException catch (e) {
      return Left(FirebaseFailure(e.message ?? 'Firebase error'));
    }
  }
}
```

---

## Riverpod State Management

```dart
// presentation/providers/order_providers.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'order_providers.g.dart';

// Repository provider
@riverpod
OrderRepository orderRepository(OrderRepositoryRef ref) {
  return FirebaseOrderRepository(ref.watch(firestoreProvider));
}

// Async data provider
@riverpod
Future<List<Order>> userOrders(UserOrdersRef ref, String userId) {
  final repository = ref.watch(orderRepositoryProvider);
  return repository.getUserOrders(userId).then(
    (result) => result.fold(
      (failure) => throw failure,
      (orders) => orders,
    ),
  );
}

// Notifier for mutations
@riverpod
class OrderNotifier extends _$OrderNotifier {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> createOrder(CreateOrderParams params) async {
    state = const AsyncValue.loading();
    final result = await ref.read(orderRepositoryProvider).createOrder(params);
    state = result.fold(
      (failure) => AsyncValue.error(failure, StackTrace.current),
      (_) => const AsyncValue.data(null),
    );
  }
}
```

---

## Navigation with go_router

```dart
// config/router.dart
import 'package:go_router/go_router.dart';
part 'router.g.dart';  // Generated by go_router_builder

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final router = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  redirect: (context, state) async {
    // Auth guard
    final isAuthenticated = await ref.read(authStateProvider.future) != null;
    final isGoingToAuth = state.matchedLocation.startsWith('/auth');
    
    if (!isAuthenticated && !isGoingToAuth) return '/auth/sign-in';
    if (isAuthenticated && isGoingToAuth) return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomePage(),
    ),
    GoRoute(
      path: '/auth/sign-in',
      builder: (context, state) => const SignInPage(),
    ),
    ShellRoute(
      // Protected routes with bottom navigation
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardPage(),
        ),
      ],
    ),
  ],
);
```

---

## Design Token Usage in Flutter

```dart
// ALWAYS use AppTokens, never hardcode values
// BAD
Container(
  color: const Color(0xFF0066FF),  // ❌ Hardcoded
  padding: const EdgeInsets.all(13),  // ❌ Not on the spacing grid
  child: Text(
    'Hello',
    style: TextStyle(fontSize: 17),  // ❌ Not a token size
  ),
)

// GOOD
Container(
  color: AppTokens.brandPrimary,  // ✅ Token
  padding: const EdgeInsets.all(AppTokens.space4),  // ✅ 16px (space-4)
  child: Text(
    'Hello',
    style: Theme.of(context).textTheme.bodyMedium,  // ✅ Theme token
  ),
)
```

---

## Error Handling in Flutter

```dart
// core/errors/failures.dart
abstract class Failure {
  final String message;
  const Failure(this.message);
}

class FirebaseFailure extends Failure {
  const FirebaseFailure(super.message);
}

class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
```

Use `Either<Failure, T>` from `fpdart` package for all repository methods.
Never throw exceptions across layer boundaries — wrap in `Failure` types.

---

## Platform-Specific Behaviour

Handle platform differences explicitly — never rely on accidental cross-platform compatibility.

```dart
import 'dart:io';

// Platform-specific UI
Widget buildBackButton(BuildContext context) {
  if (Platform.isIOS) {
    return CupertinoNavigationBarBackButton(
      onPressed: () => context.pop(),
    );
  }
  return IconButton(
    icon: const Icon(Icons.arrow_back),
    onPressed: () => context.pop(),
  );
}

// Or use adaptive widgets
AdaptiveSwitch(  // Renders as CupertinoSwitch on iOS, Switch on Android
  value: isEnabled,
  onChanged: (v) => setState(() => isEnabled = v),
)
```

---

## Testing

```dart
// Widget test example
void main() {
  group('OrderCard widget', () {
    testWidgets('displays order total correctly', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderRepositoryProvider.overrideWithValue(MockOrderRepository()),
          ],
          child: const MaterialApp(home: OrderCard(orderId: 'test-id')),
        ),
      );
      
      await tester.pumpAndSettle();
      
      expect(find.text('£29.99'), findsOneWidget);
    });
  });
}
```

Run all tests:
```bash
flutter test                    # Unit + widget tests
flutter test integration_test/  # Integration tests (needs device/emulator)
```

---

## iOS Requirements

- App Store requires Apple Sign-In when any other social login is present
- Always implement Sign in with Apple alongside Google Sign-In
- Privacy manifest (`PrivacyInfo.xcprivacy`) required from iOS 17
- Minimum iOS version: 16.0 (check App Store analytics for your audience)

## Android Requirements

- Target API level: current - 1 (e.g., API 34 if 35 is latest)
- Minimum API level: 23 (Android 6.0)
- ProGuard/R8 rules must be configured for release builds
- Test on both physical device and emulator (emulator misses some hardware features)
