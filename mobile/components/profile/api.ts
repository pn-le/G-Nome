// TODO: Replace with real backend call
// POST /api/avatar/generate-mii
// Body: { userId: string, selfieImage: string (base64), style: "mii_spotlight" }
// Response: { avatarUrl: string, thumbnailUrl: string, status: "success" }
export async function generateMiiAvatar(_selfieUri: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 2800));
  return "placeholder";
}

// TODO: Replace with Supabase upsert to user profile
// await supabase.from('profiles').upsert({ avatar_url: avatarUri })
export async function saveAvatarToProfile(_avatarUri: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600));
}
