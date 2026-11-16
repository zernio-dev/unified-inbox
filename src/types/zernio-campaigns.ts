export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
export type CampaignChannel = 'instagram' | 'whatsapp' | 'facebook' | 'telegram';

export interface Broadcast {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: BroadcastStatus;
  targetTags: string[];
  message: string;
  mediaUrl?: string;
  scheduledAt?: string;
  sentCount: number;
  totalRecipients: number;
  createdAt: string;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  delayHours: number;
  message: string;
  mediaUrl?: string;
}

export interface Sequence {
  id: string;
  name: string;
  channel: CampaignChannel;
  active: boolean;
  steps: SequenceStep[];
  enrolledCount: number;
  createdAt: string;
}

export interface CommentAutomation {
  id: string;
  name: string;
  platform: CampaignChannel;
  postUrl: string;
  postId: string;
  keyword: string;
  publicResponses: string[];
  dmMessage: string;
  triggerCount: number;
  active: boolean;
  createdAt: string;
}

export interface CreateBroadcastInput {
  name: string;
  channel: CampaignChannel;
  targetTags: string[];
  message: string;
  mediaUrl?: string;
  scheduledAt?: string;
}
