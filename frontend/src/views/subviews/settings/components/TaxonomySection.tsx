import React from "react";
import { Card, CardHeader, CardContent, Stack, Divider, Row } from "../../../../components/ui";
import { TaxonomyChipEditor } from "../../../../components/common/TaxonomyChipEditor";
import type { TaxonomyItem } from "../../../../types";

interface TaxonomySectionProps {
  categories: TaxonomyItem[];
  editingCatIndex: number | null;
  editCatName: string;
  editCatColor: string;
  handleStartEditCategory: (index: number) => void;
  setEditCatName: (name: string) => void;
  setEditCatColor: (color: string) => void;
  handleSaveEditCategory: () => void;
  setEditingCatIndex: (idx: number | null) => void;
  handleRequestRemoveCategory: (index: number) => void;
  isAddingCategory: boolean;
  newCatName: string;
  newCatColor: string;
  setIsAddingCategory: (val: boolean) => void;
  setNewCatName: (val: string) => void;
  setNewCatColor: (val: string) => void;
  handleAddCategory: () => void;

  badges: TaxonomyItem[];
  editingBadgeIndex: number | null;
  editBadgeName: string;
  editBadgeColor: string;
  handleStartEditBadge: (index: number) => void;
  setEditBadgeName: (name: string) => void;
  setEditBadgeColor: (color: string) => void;
  handleSaveEditBadge: () => void;
  setEditingBadgeIndex: (idx: number | null) => void;
  handleRequestRemoveBadge: (index: number) => void;
  isAddingBadge: boolean;
  newBadgeName: string;
  newBadgeColor: string;
  setIsAddingBadge: (val: boolean) => void;
  setNewBadgeName: (val: string) => void;
  setNewBadgeColor: (val: string) => void;
  handleAddBadge: () => void;

  tags: TaxonomyItem[];
  editingTagIndex: number | null;
  editTagName: string;
  editTagColor: string;
  handleStartEditTag: (index: number) => void;
  setEditTagName: (name: string) => void;
  setEditTagColor: (color: string) => void;
  handleSaveEditTag: () => void;
  setEditingTagIndex: (idx: number | null) => void;
  handleRequestRemoveTag: (index: number) => void;
  isAddingTag: boolean;
  newTagName: string;
  newTagColor: string;
  setIsAddingTag: (val: boolean) => void;
  setNewTagName: (val: string) => void;
  setNewTagColor: (val: string) => void;
  handleAddTag: () => void;

  statuses: TaxonomyItem[];
  editingStatusIndex: number | null;
  editStatusName: string;
  editStatusColor: string;
  handleStartEditStatus: (index: number) => void;
  setEditStatusName: (name: string) => void;
  setEditStatusColor: (color: string) => void;
  handleSaveEditStatus: () => void;
  setEditingStatusIndex: (idx: number | null) => void;
  handleRequestRemoveStatus: (index: number) => void;
  isAddingStatus: boolean;
  newStatusName: string;
  newStatusColor: string;
  setIsAddingStatus: (val: boolean) => void;
  setNewStatusName: (val: string) => void;
  setNewStatusColor: (val: string) => void;
  handleAddStatus: () => void;
}

export const TaxonomySection: React.FC<TaxonomySectionProps> = ({
  categories,
  editingCatIndex,
  editCatName,
  editCatColor,
  handleStartEditCategory,
  setEditCatName,
  setEditCatColor,
  handleSaveEditCategory,
  setEditingCatIndex,
  handleRequestRemoveCategory,
  isAddingCategory,
  newCatName,
  newCatColor,
  setIsAddingCategory,
  setNewCatName,
  setNewCatColor,
  handleAddCategory,

  badges,
  editingBadgeIndex,
  editBadgeName,
  editBadgeColor,
  handleStartEditBadge,
  setEditBadgeName,
  setEditBadgeColor,
  handleSaveEditBadge,
  setEditingBadgeIndex,
  handleRequestRemoveBadge,
  isAddingBadge,
  newBadgeName,
  newBadgeColor,
  setIsAddingBadge,
  setNewBadgeName,
  setNewBadgeColor,
  handleAddBadge,

  tags,
  editingTagIndex,
  editTagName,
  editTagColor,
  handleStartEditTag,
  setEditTagName,
  setEditTagColor,
  handleSaveEditTag,
  setEditingTagIndex,
  handleRequestRemoveTag,
  isAddingTag,
  newTagName,
  newTagColor,
  setIsAddingTag,
  setNewTagName,
  setNewTagColor,
  handleAddTag,

  statuses,
  editingStatusIndex,
  editStatusName,
  editStatusColor,
  handleStartEditStatus,
  setEditStatusName,
  setEditStatusColor,
  handleSaveEditStatus,
  setEditingStatusIndex,
  handleRequestRemoveStatus,
  isAddingStatus,
  newStatusName,
  newStatusColor,
  setIsAddingStatus,
  setNewStatusName,
  setNewStatusColor,
  handleAddStatus,
}) => {
  return (
    <section id="categories-tags" style={{ scrollMarginTop: "72px" }}>
      <Card variant="elevated">
        <CardHeader
          title="Taxonomia & Governança"
          subtitle="Personalize categorias, tags, badges e status com cores integradas do sistema."
        />
        <CardContent>
          <Stack gap="md">
            {/* 1.1 Categorias */}
            <Stack gap="xs">
              <span className="ui-text-subtitle ui-text-bold">
                Categorias
              </span>
              <TaxonomyChipEditor
                items={categories}
                editingIndex={editingCatIndex}
                editName={editCatName}
                editColor={editCatColor}
                onStartEdit={handleStartEditCategory}
                onEditNameChange={setEditCatName}
                onEditColorChange={setEditCatColor}
                onSaveEdit={handleSaveEditCategory}
                onCancelEdit={() => setEditingCatIndex(null)}
                onRequestRemove={handleRequestRemoveCategory}
                isAdding={isAddingCategory}
                newName={newCatName}
                newColor={newCatColor}
                onStartAdd={() => setIsAddingCategory(true)}
                onNewNameChange={setNewCatName}
                onNewColorChange={setNewCatColor}
                onSaveAdd={handleAddCategory}
                onCancelAdd={() => {
                  setIsAddingCategory(false);
                  setNewCatName("");
                }}
                placeholder="categoria..."
                addTooltip="Adicionar Categoria"
              />
            </Stack>

            <Divider />

            {/* 1.2 Tipos de Documento / Badges */}
            <Stack gap="xs">
              <Row align="center" justify="between">
                <span className="ui-text-subtitle ui-text-bold">
                  Tipos de Documento (Badges)
                </span>
              </Row>
              <TaxonomyChipEditor
                items={badges}
                editingIndex={editingBadgeIndex}
                editName={editBadgeName}
                editColor={editBadgeColor}
                onStartEdit={handleStartEditBadge}
                onEditNameChange={setEditBadgeName}
                onEditColorChange={setEditBadgeColor}
                onSaveEdit={handleSaveEditBadge}
                onCancelEdit={() => setEditingBadgeIndex(null)}
                onRequestRemove={handleRequestRemoveBadge}
                isAdding={isAddingBadge}
                newName={newBadgeName}
                newColor={newBadgeColor}
                onStartAdd={() => setIsAddingBadge(true)}
                onNewNameChange={setNewBadgeName}
                onNewColorChange={setNewBadgeColor}
                onSaveAdd={handleAddBadge}
                onCancelAdd={() => {
                  setIsAddingBadge(false);
                  setNewBadgeName("");
                }}
                placeholder="tipo..."
                addTooltip="Adicionar Tipo de Documento / Badge"
              />
            </Stack>

            <Divider />

            {/* 1.3 Tags */}
            <Stack gap="xs">
              <span className="ui-text-subtitle ui-text-bold">Tags</span>
              <TaxonomyChipEditor
                items={tags}
                editingIndex={editingTagIndex}
                editName={editTagName}
                editColor={editTagColor}
                onStartEdit={handleStartEditTag}
                onEditNameChange={setEditTagName}
                onEditColorChange={setEditTagColor}
                onSaveEdit={handleSaveEditTag}
                onCancelEdit={() => setEditingTagIndex(null)}
                onRequestRemove={handleRequestRemoveTag}
                isAdding={isAddingTag}
                newName={newTagName}
                newColor={newTagColor}
                onStartAdd={() => setIsAddingTag(true)}
                onNewNameChange={setNewTagName}
                onNewColorChange={setNewTagColor}
                onSaveAdd={handleAddTag}
                onCancelAdd={() => {
                  setIsAddingTag(false);
                  setNewTagName("");
                }}
                placeholder="tag..."
                addTooltip="Adicionar Tag"
              />
            </Stack>

            <Divider />

            {/* 1.4 Status */}
            <Stack gap="xs">
              <span className="ui-text-subtitle ui-text-bold">
                Status de Documento
              </span>
              <TaxonomyChipEditor
                items={statuses}
                editingIndex={editingStatusIndex}
                editName={editStatusName}
                editColor={editStatusColor}
                onStartEdit={handleStartEditStatus}
                onEditNameChange={setEditStatusName}
                onEditColorChange={setEditStatusColor}
                onSaveEdit={handleSaveEditStatus}
                onCancelEdit={() => setEditingStatusIndex(null)}
                onRequestRemove={handleRequestRemoveStatus}
                isAdding={isAddingStatus}
                newName={newStatusName}
                newColor={newStatusColor}
                onStartAdd={() => setIsAddingStatus(true)}
                onNewNameChange={setNewStatusName}
                onNewColorChange={setNewStatusColor}
                onSaveAdd={handleAddStatus}
                onCancelAdd={() => {
                  setIsAddingStatus(false);
                  setNewStatusName("");
                }}
                placeholder="status..."
                addTooltip="Adicionar Status"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </section>
  );
};
