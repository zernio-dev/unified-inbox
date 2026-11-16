'use client';

import { useState } from 'react';
import { Zap, Plus, Trash2, Edit2, Search, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import type { QuickReply } from '@/app/api/quick-replies/route';

interface QuickRepliesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectReply: (reply: QuickReply) => void;
  profileId?: string;
}

export function QuickRepliesDrawer({
  open,
  onOpenChange,
  onSelectReply,
  profileId = 'default',
}: QuickRepliesDrawerProps) {
  const { quickReplies, isLoading, addQuickReply, updateQuickReply, deleteQuickReply } =
    useQuickReplies(profileId);

  const [search, setSearch] = useState('');
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('geral');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setShortcut('');
    setTitle('');
    setContent('');
    setCategory('geral');
    setEditingReply(null);
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setShortcut(reply.shortcut);
    setTitle(reply.title);
    setContent(reply.content);
    setCategory(reply.category || 'geral');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcut.trim() || !title.trim() || !content.trim()) {
      toast.error('Preencha atalho, título e conteúdo');
      return;
    }

    setSaving(true);
    try {
      if (editingReply) {
        await updateQuickReply({
          id: editingReply.id,
          shortcut: shortcut.trim(),
          title: title.trim(),
          content: content.trim(),
          category,
        });
        toast.success('Resposta rápida atualizada!');
      } else {
        await addQuickReply({
          shortcut: shortcut.trim(),
          title: title.trim(),
          content: content.trim(),
          category,
        });
        toast.success('Resposta rápida criada com sucesso!');
      }
      resetForm();
    } catch {
      toast.error('Erro ao salvar resposta rápida');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir esta resposta rápida?')) return;
    try {
      await deleteQuickReply(id);
      toast.success('Resposta rápida excluída');
    } catch {
      toast.error('Erro ao excluir resposta rápida');
    }
  };


  const filtered = quickReplies.filter(
    (r) =>
      r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      (r.category && r.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Zap className="size-5 text-primary fill-primary/20" />
            <span>Respostas Rápidas</span>
          </DialogTitle>
          {!isFormOpen && (
            <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              <span>Nova Resposta</span>
            </Button>
          )}
        </DialogHeader>

        {isFormOpen ? (
          <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h4 className="text-sm font-semibold">
                {editingReply ? 'Editar Resposta Rápida' : 'Criar Nova Resposta Rápida'}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="h-7 text-xs"
              >
                Voltar à Lista
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shortcut" className="text-xs">
                  Atalho (começa com /)
                </Label>
                <Input
                  id="shortcut"
                  placeholder="/pix"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">
                  Título / Nome
                </Label>
                <Input
                  id="title"
                  placeholder="Dados PIX"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content" className="text-xs">
                Mensagem
              </Label>
              <Textarea
                id="content"
                rows={4}
                placeholder="Escreva o texto da resposta frequente..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="text-xs resize-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs">
                Categoria
              </Label>
              <Input
                id="category"
                placeholder="atendimento, pagamento, horarios..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Salvar Resposta
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atalho, título ou conteúdo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Nenhuma resposta rápida cadastrada. Clique em &quot;Nova Resposta&quot; para adicionar.
                </div>
              ) : (
                filtered.map((reply) => (
                  <div
                    key={reply.id}
                    onClick={() => {
                      onSelectReply(reply);
                      onOpenChange(false);
                    }}
                    className="p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer group flex flex-col gap-1 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {reply.shortcut}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {reply.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(reply);
                          }}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(reply.id, e)}
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
                      {reply.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
