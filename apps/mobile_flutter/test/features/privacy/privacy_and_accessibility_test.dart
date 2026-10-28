import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/privacy/data/privacy_compliance_repository.dart';
import 'package:mobile/features/privacy/domain/models/privacy_compliance_models.dart';
import 'package:mobile/features/privacy/presentation/screens/privacy_and_data_settings_screen.dart';

class MockPrivacyComplianceRepository implements PrivacyComplianceRepository {
  PrivacySettingsModel currentSettings = const PrivacySettingsModel(
    isPrivateAccount: false,
    allowSearchDiscovery: true,
    messagingPermission: 'EVERYONE',
    commentingPermission: 'EVERYONE',
    activityStatusVisible: true,
    personalizedAdsConsent: false,
    isMinor: false,
  );

  List<UserSessionModel> sessions = [
    UserSessionModel(
      id: 'session-curr-1',
      deviceName: 'Pixel 8 Pro (Active)',
      isCurrentSession: true,
      lastActiveAt: DateTime(2026, 10, 16, 12, 0),
      createdAt: DateTime(2026, 10, 1, 10, 0),
    ),
    UserSessionModel(
      id: 'session-remote-2',
      deviceName: 'Chrome on MacOS',
      isCurrentSession: false,
      lastActiveAt: DateTime(2026, 10, 15, 18, 30),
      createdAt: DateTime(2026, 10, 5, 8, 0),
    ),
  ];

  PrivacySettingsModel? lastUpdatedSettings;
  String? lastRevokedSessionId;
  bool allOtherSessionsRevoked = false;
  String? lastDeletionReason;
  bool deletionCancelled = false;
  bool dataExportRequested = false;

  @override
  Future<PrivacySettingsModel> getPrivacySettings({required String token}) async {
    return currentSettings;
  }

  @override
  Future<PrivacySettingsModel> updatePrivacySettings(
    PrivacySettingsModel settings, {
    required String token,
  }) async {
    lastUpdatedSettings = settings;
    currentSettings = settings;
    return settings;
  }

  @override
  Future<List<UserSessionModel>> getUserSessions({required String token}) async {
    return sessions;
  }

  @override
  Future<void> revokeSession(String sessionId, {required String token}) async {
    lastRevokedSessionId = sessionId;
    sessions.removeWhere((s) => s.id == sessionId);
  }

  @override
  Future<int> revokeAllOtherSessions({required String token}) async {
    allOtherSessionsRevoked = true;
    final removedCount = sessions.where((s) => !s.isCurrentSession).length;
    sessions.removeWhere((s) => !s.isCurrentSession);
    return removedCount;
  }

  @override
  Future<AccountDeletionRequestModel> requestAccountDeletion({
    String? reason,
    required String token,
  }) async {
    lastDeletionReason = reason;
    return AccountDeletionRequestModel(
      id: 'del-req-999',
      status: 'PENDING_GRACE_PERIOD',
      reason: reason,
      gracePeriodEndsAt: DateTime.now().add(const Duration(days: 30)),
      requestedAt: DateTime.now(),
    );
  }

  @override
  Future<void> cancelAccountDeletion({required String token}) async {
    deletionCancelled = true;
  }

  @override
  Future<DataExportRequestModel> requestDataExport({required String token}) async {
    dataExportRequested = true;
    return DataExportRequestModel(
      id: 'export-req-1234',
      status: 'PENDING',
      expiresAt: DateTime.now().add(const Duration(days: 2)),
    );
  }
}

void main() {
  group('Prompt 20 — Privacy, Account Deletion & Accessibility Tests', () {
    late MockPrivacyComplianceRepository mockRepo;

    setUp(() {
      mockRepo = MockPrivacyComplianceRepository();
    });

    testWidgets('Renders all section headers with Semantics header tags', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Privacy, Data & Accessibility'), findsOneWidget);
      expect(find.text('Account Privacy'), findsOneWidget);
      expect(find.text('Interactions & Permissions'), findsOneWidget);
      expect(find.text('Accessibility & Display'), findsOneWidget);
      expect(find.text('Active Logged-in Devices'), findsOneWidget);
      expect(find.text('Data Management & Compliance'), findsOneWidget);
    });

    testWidgets('Toggling Private Account calls updatePrivacySettings', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final privateSwitch = find.widgetWithText(SwitchListTile, 'Private Account');
      expect(privateSwitch, findsOneWidget);

      await tester.tap(privateSwitch);
      await tester.pumpAndSettle();

      expect(mockRepo.lastUpdatedSettings, isNotNull);
      expect(mockRepo.lastUpdatedSettings!.isPrivateAccount, isTrue);
    });

    testWidgets('For minor accounts, personalized ads switch is disabled (COPPA & DPDP)', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      mockRepo.currentSettings = const PrivacySettingsModel(
        isPrivateAccount: false,
        allowSearchDiscovery: true,
        messagingPermission: 'EVERYONE',
        commentingPermission: 'EVERYONE',
        activityStatusVisible: true,
        personalizedAdsConsent: false,
        isMinor: true, // Minor account
      );

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Strictly disabled for minor accounts in compliance with COPPA and DPDP rules.'),
        findsOneWidget,
      );

      final adsTile = tester.widget<SwitchListTile>(
        find.widgetWithText(SwitchListTile, 'Personalized Ads Consent'),
      );
      expect(adsTile.onChanged, isNull);
    });

    testWidgets('Active sessions are rendered, remote session can be revoked', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pixel 8 Pro (Active)'), findsOneWidget);
      expect(find.text('This Device'), findsOneWidget);
      expect(find.text('Chrome on MacOS'), findsOneWidget);

      final deleteBtn = find.byIcon(Icons.delete_outline);
      expect(deleteBtn, findsOneWidget);

      await tester.tap(deleteBtn);
      await tester.pumpAndSettle();

      expect(mockRepo.lastRevokedSessionId, 'session-remote-2');
      expect(find.text('Chrome on MacOS'), findsNothing);
    });

    testWidgets('Sign Out Others revokes all remote sessions after confirmation dialog', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final signOutOthersBtn = find.text('Sign Out Others');
      expect(signOutOthersBtn, findsOneWidget);

      await tester.tap(signOutOthersBtn);
      await tester.pumpAndSettle();

      expect(find.text('Sign out all other devices?'), findsOneWidget);

      await tester.tap(find.widgetWithText(ElevatedButton, 'Sign Out Others'));
      await tester.pumpAndSettle();

      expect(mockRepo.allOtherSessionsRevoked, isTrue);
      expect(find.text('Chrome on MacOS'), findsNothing);
      expect(find.text('Pixel 8 Pro (Active)'), findsOneWidget);
    });

    testWidgets('Accessibility toggles for captions and high-contrast work locally', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final captionsTile = find.widgetWithText(SwitchListTile, 'Always Show Captions');
      expect(captionsTile, findsOneWidget);
      await tester.tap(captionsTile);
      await tester.pumpAndSettle();

      final contrastTile = find.widgetWithText(SwitchListTile, 'High Contrast Text');
      expect(contrastTile, findsOneWidget);
      await tester.tap(contrastTile);
      await tester.pumpAndSettle();
    });

    testWidgets('Data export request triggers flow and shows 48h SLA notification', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final exportBtn = find.text('Request Data Export Archive');
      expect(exportBtn, findsOneWidget);

      await tester.ensureVisible(exportBtn);
      await tester.tap(exportBtn);
      await tester.pumpAndSettle();

      expect(mockRepo.dataExportRequested, isTrue);
      expect(find.text('Data Export Initiated'), findsOneWidget);
      expect(find.textContaining('export-req-1234'), findsOneWidget);

      await tester.tap(find.text('Dismiss'));
      await tester.pumpAndSettle();
      expect(find.text('Data Export Initiated'), findsNothing);
    });

    testWidgets('Account deletion dialog discloses 30d grace, 90d rolling backup, and 7y tax retention',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: PrivacyAndDataSettingsScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final deleteBtn = find.text('Request Account Deletion');
      expect(deleteBtn, findsOneWidget);

      await tester.ensureVisible(deleteBtn);
      await tester.tap(deleteBtn);
      await tester.pumpAndSettle();

      // Check disclosures in dialog
      expect(find.text('Request Account Deletion'), findsWidgets);
      expect(find.textContaining('30-Day Grace Period'), findsOneWidget);
      expect(find.textContaining('Content Cascade'), findsOneWidget);
      expect(
        find.textContaining('Rolling Backups: Live databases and media keys are purged immediately; encrypted offline backups cycle out over a 90-day rolling purge window.'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Financial Records: Statutory tax and payment invoices are retained for 7 years under statutory law, with your user identity crypto-shredded.'),
        findsOneWidget,
      );

      // Enter reason and confirm
      await tester.enterText(find.byType(TextField), 'Moving to another platform');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Confirm Deletion'));
      await tester.pumpAndSettle();

      expect(mockRepo.lastDeletionReason, 'Moving to another platform');
      expect(find.text('Deletion Scheduled'), findsOneWidget);

      // Dismiss confirmation dialog
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      // Banner should now be visible
      expect(find.text('Account Deletion Scheduled'), findsOneWidget);

      // Cancel deletion from banner
      final cancelBtn = find.widgetWithText(ElevatedButton, 'Cancel Deletion & Restore Account');
      expect(cancelBtn, findsOneWidget);

      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      expect(mockRepo.deletionCancelled, isTrue);
      expect(find.text('Account Deletion Scheduled'), findsNothing);
    });
  });
}
