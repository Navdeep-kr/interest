'use client';

import React, { useState } from 'react';
import {
  Network,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers,
  FolderTree,
  Tag,
  X,
} from 'lucide-react';
import { COMPREHENSIVE_TAXONOMY, RawTaxonomyCategory } from '@interest/shared';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface EditableTaxonomyCategory extends RawTaxonomyCategory {}

export default function TaxonomyEditorPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [categories, setCategories] = useState<EditableTaxonomyCategory[]>(COMPREHENSIVE_TAXONOMY);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'technology-computing': true,
    'culinary-arts': true,
  });

  // Modal for adding a new node
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetCategorySlug, setTargetCategorySlug] = useState('');
  const [targetTopicSlug, setTargetTopicSlug] = useState('');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeSlug, setNewNodeSlug] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');

  const canEdit = hasPermission(AdminPermission.EDIT_TAXONOMY);

  const toggleCategory = (slug: string) => {
    setExpandedCategories((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleAddNode = () => {
    if (!newNodeTitle.trim() || !newNodeSlug.trim()) return;

    if (targetCategorySlug && targetTopicSlug) {
      // Add Level 2 Niche under targetTopic
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.slug !== targetCategorySlug) return cat;
          return {
            ...cat,
            topics: cat.topics.map((top) => {
              if (top.slug !== targetTopicSlug) return top;
              return {
                ...top,
                niches: [
                  ...top.niches,
                  {
                    slug: newNodeSlug.trim().toLowerCase(),
                    title: newNodeTitle.trim(),
                    description: newNodeDescription.trim(),
                  },
                ],
              };
            }),
          };
        }),
      );

      auditManager.recordLog({
        actorName: admin.name,
        actorRole: admin.role,
        action: 'TAXONOMY_NICHE_ADDED',
        targetEntity: `Niche: "${newNodeTitle}" under ${targetTopicSlug}`,
        details: `Added new 3rd-tier niche node with synthetic 512-d embedding.`,
      });
    }

    setShowAddModal(false);
    setNewNodeTitle('');
    setNewNodeSlug('');
    setNewNodeDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Interest Taxonomy Editor</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage the universal 3-tier semantic interest graph used for embeddings, feed matching, and reels tagging.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setTargetCategorySlug(categories[0]?.slug || '');
              setTargetTopicSlug(categories[0]?.topics[0]?.slug || '');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-rose-900/30"
          >
            <Plus className="w-4 h-4" />
            Add Taxonomy Node
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search taxonomy categories, topics, or deep niches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Taxonomy Tree View */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const isExpanded = !!expandedCategories[cat.slug] || search.length > 0;
          const totalNiches = cat.topics.reduce((acc, t) => acc + t.niches.length, 0);

          return (
            <div
              key={cat.slug}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg"
            >
              {/* Level 0 Header */}
              <div
                onClick={() => toggleCategory(cat.slug)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-850/60 transition border-b border-zinc-800/80"
              >
                <div className="flex items-center space-x-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-rose-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-rose-500 uppercase tracking-widest font-mono">
                        Level 0 Category
                      </span>
                      <span className="text-xs font-mono text-zinc-500">slug: {cat.slug}</span>
                    </div>
                    <h2 className="text-lg font-black text-white mt-0.5">{cat.title}</h2>
                    <p className="text-xs text-zinc-400">{cat.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono bg-zinc-800 px-3 py-1 rounded-lg text-zinc-300">
                    {cat.topics.length} Topics • {totalNiches} Niches
                  </span>
                </div>
              </div>

              {/* Topics & Niches (Level 1 & Level 2) */}
              {isExpanded && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/40">
                  {cat.topics.map((topic) => (
                    <div
                      key={topic.slug}
                      className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            <h3 className="font-extrabold text-sm text-zinc-200">{topic.title}</h3>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono block">
                            slug: {topic.slug}
                          </span>
                        </div>
                        <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded font-bold font-mono">
                          Level 1
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400">{topic.description}</p>

                      {/* Level 2 Niches */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            Level 2 Niches ({topic.niches.length}):
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {topic.niches.map((niche) => (
                            <span
                              key={niche.slug}
                              className="bg-zinc-900 border border-zinc-800 text-indigo-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono group hover:border-indigo-600 transition"
                              title={niche.description}
                            >
                              <Tag className="w-3 h-3 text-indigo-400" />
                              {niche.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-rose-500" />
                Add Taxonomy Niche (Level 2)
              </h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Parent Category</label>
                <select
                  value={targetCategorySlug}
                  onChange={(e) => {
                    setTargetCategorySlug(e.target.value);
                    const selectedCat = categories.find((c) => c.slug === e.target.value);
                    if (selectedCat && selectedCat.topics[0]) {
                      setTargetTopicSlug(selectedCat.topics[0].slug);
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Parent Topic</label>
                <select
                  value={targetTopicSlug}
                  onChange={(e) => setTargetTopicSlug(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
                >
                  {categories
                    .find((c) => c.slug === targetCategorySlug)
                    ?.topics.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Niche Title</label>
                <input
                  type="text"
                  placeholder="e.g. Fine-Tuning LoRA"
                  value={newNodeTitle}
                  onChange={(e) => {
                    setNewNodeTitle(e.target.value);
                    setNewNodeSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Slug</label>
                <input
                  type="text"
                  placeholder="fine-tuning-lora"
                  value={newNodeSlug}
                  onChange={(e) => setNewNodeSlug(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Description</label>
                <textarea
                  placeholder="Description of this interest domain..."
                  value={newNodeDescription}
                  onChange={(e) => setNewNodeDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNode}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition"
              >
                Save Niche & Generate Vector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
