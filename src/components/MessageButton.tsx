import { startConversation } from '@/lib/message-actions';

export function MessageButton({ userId }: { userId: string }) {
  return (
    <form action={startConversation}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">
        Message
      </button>
    </form>
  );
}
