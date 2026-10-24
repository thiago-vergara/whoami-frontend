export type EventStatus = 'OPEN' | 'DRAWN' | 'CANCELLED'
export interface AuthConfiguration {
  url: string
  publishableKey: string
}
export interface Profile {
  id: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
}
export interface Participant {
  userId: string
  fullName: string
}
export interface EventSummary {
  id: string
  title: string
  status: EventStatus
  drawAt: string
  exchangeAt: string
  participantCount: number
}
export interface EventView extends EventSummary {
  organizerId: string
  description: string
  createdAt: string
  timezone: string
  autoDraw: boolean
  modality: 'VIRTUAL' | 'IN_PERSON'
  platform: string | null
  meetingUrl: string | null
  address: string | null
  giftBudgetMinor: number | null
  currency: string
  drawnAt: string | null
  version: number
  coverImage: string
  blockedReason: string | null
  participants: Participant[]
}
export interface EventRequest {
  title: string
  description: string
  drawDate: string
  exchangeAt: string
  timezone: string
  autoDraw: boolean
  modality: 'VIRTUAL' | 'IN_PERSON'
  platform: string | null
  meetingUrl: string | null
  address: string | null
  giftBudgetMinor: number | null
}
export interface Invitation {
  token: string
  url: string
}
export interface InvitationPreview {
  eventId: string
  title: string
  description: string
  drawAt: string
  exchangeAt: string
  giftBudgetMinor: number | null
  organizerName: string
  status: EventStatus
}
export interface Wish {
  id: string
  title: string
  referenceUrl: string | null
  referencePlace: string | null
}
export type WishRequest = Omit<Wish, 'id'>
export interface Assignment {
  recipientId: string
  fullName: string
  wishlist: Wish[]
  recipientUnavailable: boolean
}
export interface DrawResult {
  eventId: string
  drawnAt: string
  participantCount: number
}
export interface UploadTicket {
  id: string
  uploadUrl: string
  contentType: string
  expiresInSeconds: number
}
export type NotificationStats = Partial<
  Record<'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED', number>
>
