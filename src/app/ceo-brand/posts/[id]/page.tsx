"use client";

/* CEO Brand — one post in the composer (owner, 29/09/2026): /posts/new writes
   a new one, /posts/<id> opens a saved one — the CEO approves it. */

import { use } from "react";
import AuthGate from "@/components/admin/AuthGate";
import PostComposer from "@/components/marketing/PostComposer";

export default function CeoBrandPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <PostComposer space="ceo" postId={id} />
    </AuthGate>
  );
}
