"use client";

/* Social Marketing — one post in the composer: /posts/new writes a new one,
   /posts/<id> opens a saved one (to edit, approve, or follow its results). */

import { use } from "react";
import AuthGate from "@/components/admin/AuthGate";
import PostComposer from "@/components/marketing/PostComposer";

export default function SocialMarketingPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <PostComposer space="company" postId={id} />
    </AuthGate>
  );
}
