import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreatorDraftsService } from './creator-drafts.service';
import { DatabaseService } from '../../database/database.service';

describe('CreatorDraftsService', () => {
  let service: CreatorDraftsService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorDraftsService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<CreatorDraftsService>(CreatorDraftsService);
  });

  it('should save a new draft with editor state', async () => {
    const editorState = {
      clips: [{ id: 'c1', uri: 'file://c1.mp4', durationSeconds: 10, startTimeSeconds: 0, endTimeSeconds: 10, speed: 1 }],
      textOverlays: [{ id: 't1', text: 'Step 1', color: '#ffffff', fontSize: 24, xPercent: 50, yPercent: 20, startTimeSeconds: 0, endTimeSeconds: 5 }],
      stickers: [],
      filter: 'cyberpunk' as const,
      autoCaptions: true,
      playbackSpeed: 1,
    };

    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'draft-1',
          user_id: 'user-1',
          title: 'Draft Reel',
          caption: 'Learning prompt engineering',
          primary_interest_id: 'int-1',
          secondary_tag_ids: [],
          hashtags: ['#ai'],
          cover_timestamp: '2.5',
          video_uri: 'file://v1.mp4',
          editor_state: JSON.stringify(editorState),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const res = await service.saveDraft('user-1', {
      title: 'Draft Reel',
      caption: 'Learning prompt engineering',
      primaryInterestId: 'int-1',
      coverTimestamp: 2.5,
      videoUri: 'file://v1.mp4',
      editorState,
    });

    expect(res.id).toBe('draft-1');
    expect(res.title).toBe('Draft Reel');
    expect(res.editorState.filter).toBe('cyberpunk');
  });

  it('should list creator drafts', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'draft-1',
          user_id: 'user-1',
          title: 'Draft 1',
          editor_state: '{}',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const res = await service.getDrafts('user-1');
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('draft-1');
  });

  it('should throw NotFoundException on deleting non-existent draft', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.deleteDraft('user-1', 'bad-draft')).rejects.toThrow(
      NotFoundException,
    );
  });
});
