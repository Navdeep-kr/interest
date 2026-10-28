import 'package:flutter/material.dart';
import '../data/learn_repository.dart';
import '../domain/models/learn_models.dart';

class LearnNotifier extends ChangeNotifier {
  final LearnRepository _repository;

  bool _isLoading = false;
  String? _error;

  String _selectedLevel = 'ALL';
  String _credentialFilter = 'ALL'; // ALL, VERIFIED, CREATOR

  List<SkillPathModel> _paths = [];
  SkillPathModel? _resumePath;
  LessonItemModel? _resumeLesson;
  UserPathProgressModel? _resumeProgress;
  UserLearnReminderModel? _reminderSettings;

  LearnNotifier({required LearnRepository repository})
      : _repository = repository;

  bool get isLoading => _isLoading;
  String? get error => _error;
  String get selectedLevel => _selectedLevel;
  String get credentialFilter => _credentialFilter;
  List<SkillPathModel> get paths => _paths;
  SkillPathModel? get resumePath => _resumePath;
  LessonItemModel? get resumeLesson => _resumeLesson;
  UserPathProgressModel? get resumeProgress => _resumeProgress;
  UserLearnReminderModel? get reminderSettings => _reminderSettings;

  List<SkillPathModel> get filteredPaths {
    return _paths.where((p) {
      if (_selectedLevel != 'ALL' && p.level != _selectedLevel) {
        return false;
      }
      if (_credentialFilter == 'VERIFIED' && !p.isVerifiedCredential) {
        return false;
      }
      if (_credentialFilter == 'CREATOR' && p.isVerifiedCredential) {
        return false;
      }
      return true;
    }).toList();
  }

  List<SkillPathModel> get verifiedCredentials {
    return _paths.where((p) => p.isVerifiedCredential).toList();
  }

  List<SkillPathModel> get creatorPlaylists {
    return _paths.where((p) => !p.isVerifiedCredential).toList();
  }

  Future<void> loadInitialData() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.fetchSkillPaths(),
        _repository.fetchResumeSession(),
        _repository.fetchReminderSettings(),
      ]);

      _paths = results[0] as List<SkillPathModel>;

      final resumeData = results[1] as Map<String, dynamic>;
      _resumePath = resumeData['activePath'] as SkillPathModel?;
      _resumeLesson = resumeData['currentLesson'] as LessonItemModel?;
      _resumeProgress = resumeData['progress'] as UserPathProgressModel?;

      _reminderSettings = results[2] as UserLearnReminderModel?;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setLevelFilter(String level) {
    if (_selectedLevel == level) return;
    _selectedLevel = level;
    notifyListeners();
  }

  void setCredentialFilter(String filter) {
    if (_credentialFilter == filter) return;
    _credentialFilter = filter;
    notifyListeners();
  }

  Future<void> recordLessonCompleted({
    required String pathId,
    required String lessonId,
    int? timeSpentSeconds,
  }) async {
    try {
      final updatedProgress = await _repository.recordProgress(
        pathId: pathId,
        lessonId: lessonId,
        completed: true,
        timeSpentSeconds: timeSpentSeconds,
      );

      if (updatedProgress != null) {
        _resumeProgress = updatedProgress;
        // Refresh resume session
        final resumeData = await _repository.fetchResumeSession();
        _resumePath = resumeData['activePath'] as SkillPathModel?;
        _resumeLesson = resumeData['currentLesson'] as LessonItemModel?;
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<bool> submitDifficultyFeedback({
    required String pathId,
    String? lessonId,
    required String feedback, // TOO_EASY, JUST_RIGHT, TOO_HARD
    required int ratingScore,
    String? comments,
  }) async {
    try {
      final success = await _repository.submitFeedback(
        pathId: pathId,
        lessonId: lessonId,
        feedback: feedback,
        ratingScore: ratingScore,
        comments: comments,
      );
      if (success) {
        // Refresh path details
        final refreshed = await _repository.fetchSkillPaths();
        _paths = refreshed;
        notifyListeners();
      }
      return success;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> updateReminders({
    required bool enabled,
    required String reminderTime,
    required List<int> daysOfWeek,
    required String channel,
    String? targetSkillPathId,
  }) async {
    try {
      final updated = await _repository.updateReminderSettings(
        enabled: enabled,
        reminderTime: reminderTime,
        daysOfWeek: daysOfWeek,
        channel: channel,
        targetSkillPathId: targetSkillPathId,
      );
      _reminderSettings = updated;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
