import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/safety/domain/models/safety_models.dart';
import 'package:mobile/features/safety/data/safety_repository.dart';
import 'package:mobile/features/safety/presentation/dialogs/report_content_dialog.dart';
import 'package:mobile/features/safety/presentation/screens/safety_center_screen.dart';

class MockSafetyRepository implements SafetyRepository {
  CreateReportRequest? lastReportRequest;
  CreateAppealRequest? lastAppealRequest;
  String? lastUnblockedUserId;

  UserAccountSafetyStatus safetyStatus = const UserAccountSafetyStatus(
    userId: 'user-123',
    isActive: true,
    isSuspended: false,
    strikesCount: 0,
    isPostingRestricted: false,
    isMessagingRestricted: false,
    isCommentingRestricted: false,
  );

  List<CommunityGuidelineItem> guidelines = [
    CommunityGuidelineItem(
      id: 'guide_minor_safety',
      title: 'Child Safety & Protection',
      category: 'SAFETY_CRITICAL',
      description: 'Zero tolerance for CSAM or exploitation of minors.',
      enforcementAction: 'Immediate permanent ban',
      updatedAt: DateTime(2026, 10, 1),
    ),
    CommunityGuidelineItem(
      id: 'guide_harassment',
      title: 'Anti-Harassment & Bullying',
      category: 'COMMUNITY',
      description: 'Targeted attacks and abuse are strictly prohibited.',
      enforcementAction: 'Strikes and progressive account restrictions',
      updatedAt: DateTime(2026, 10, 1),
    ),
  ];

  List<BlockedUserItem> blockedUsers = [
    BlockedUserItem(
      id: 'blocked-1',
      username: 'troll99',
      displayName: 'Troll User',
      createdAt: DateTime(2026, 9, 15),
    ),
  ];

  @override
  Future<ReportResponse> submitReport(CreateReportRequest request, {required String token}) async {
    lastReportRequest = request;
    return ReportResponse(
      success: true,
      reportId: 'rep-mock-99',
      isUrgent: request.category.isUrgent,
      message: request.category.isUrgent
          ? 'Urgent safety report submitted.'
          : 'Report submitted successfully.',
    );
  }

  @override
  Future<UserAccountSafetyStatus> getUserSafetyStatus({required String token}) async {
    return safetyStatus;
  }

  @override
  Future<List<CommunityGuidelineItem>> getCommunityGuidelines() async {
    return guidelines;
  }

  @override
  Future<List<BlockedUserItem>> getBlockedUsers({required String token}) async {
    return blockedUsers;
  }

  @override
  Future<void> blockUser(String userId, {required String token}) async {}

  @override
  Future<void> unblockUser(String userId, {required String token}) async {
    lastUnblockedUserId = userId;
    blockedUsers.removeWhere((u) => u.id == userId);
  }

  @override
  Future<void> submitAppeal(CreateAppealRequest request, {required String token}) async {
    lastAppealRequest = request;
  }
}

void main() {
  group('Prompt 19 — Moderation & Safety Center Flutter Tests', () {
    late MockSafetyRepository mockRepo;

    setUp(() {
      mockRepo = MockSafetyRepository();
    });

    testWidgets('ReportContentDialog renders target info and submits report', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReportContentDialog(
              targetType: ReportTargetType.reel,
              targetId: 'reel-abc-123',
              targetTitle: 'Viral Dance Video by @dancer',
              token: 'test-token',
              repository: mockRepo,
            ),
          ),
        ),
      );

      // Verify title & target rendered
      expect(find.text('Report Content'), findsOneWidget);
      expect(find.text('Viral Dance Video by @dancer'), findsOneWidget);

      // Submit report
      await tester.tap(find.byKey(const Key('submit_report_button')));
      await tester.pumpAndSettle();

      expect(mockRepo.lastReportRequest, isNotNull);
      expect(mockRepo.lastReportRequest!.targetId, 'reel-abc-123');
      expect(mockRepo.lastReportRequest!.targetType, ReportTargetType.reel);
    });

    testWidgets('SafetyCenterScreen renders Account in Good Standing for clean account', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SafetyCenterScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Safety & Guidelines Center'), findsOneWidget);
      expect(find.text('Account in Good Standing'), findsOneWidget);
      expect(find.textContaining('0 active policy strikes'), findsOneWidget);
      expect(find.byKey(const Key('appeal_button')), findsNothing);
    });

    testWidgets('SafetyCenterScreen renders Account Under Restriction with strike details & appeal action',
        (tester) async {
      mockRepo.safetyStatus = UserAccountSafetyStatus(
        userId: 'user-violator',
        isActive: false,
        isSuspended: true,
        suspensionReason: 'Severe harassment violation',
        suspensionExpiresAt: DateTime.now().add(const Duration(days: 7)),
        strikesCount: 3,
        isPostingRestricted: true,
        isMessagingRestricted: false,
        isCommentingRestricted: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SafetyCenterScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Account Under Restriction / Warnings'), findsOneWidget);
      expect(find.textContaining('accumulated 3 strike(s)'), findsOneWidget);
      expect(find.text('Account Suspended'), findsOneWidget);
      expect(find.text('Publishing Restricted'), findsOneWidget);
      expect(find.byKey(const Key('appeal_button')), findsOneWidget);
    });

    testWidgets('SafetyCenterScreen displays community guidelines tab', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SafetyCenterScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Guidelines Tab
      await tester.tap(find.text('Guidelines'));
      await tester.pumpAndSettle();

      expect(find.text('Child Safety & Protection'), findsOneWidget);
      expect(find.text('Anti-Harassment & Bullying'), findsOneWidget);
      expect(find.text('Category: SAFETY_CRITICAL'), findsOneWidget);
    });

    testWidgets('SafetyCenterScreen lists blocked users and triggers unblock action', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SafetyCenterScreen(
            token: 'test-token',
            repository: mockRepo,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Blocked Users Tab
      await tester.tap(find.text('Blocked Users'));
      await tester.pumpAndSettle();

      expect(find.text('Troll User'), findsOneWidget);
      expect(find.text('@troll99'), findsOneWidget);

      // Tap Unblock
      await tester.tap(find.text('Unblock'));
      await tester.pumpAndSettle();

      expect(mockRepo.lastUnblockedUserId, 'blocked-1');
      expect(find.text('No Blocked Users'), findsOneWidget);
    });
  });
}
