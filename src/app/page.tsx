import { redirect } from 'next/navigation';

// Middleware sends signed-out visitors to /login; signed-in users land on the feed.
export default function Home() {
  redirect('/feed');
}
