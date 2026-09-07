import { UserCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { profileMediaApi } from "../../services/api";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function initialsFor(user) {
  return String(user?.name || user?.email || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ProfileAvatar({ user, className, imageClassName }) {
  const fallbackPhotoUrl =
    user?.profile_photo_url || user?.profilePhotoUrl || user?.photo_url || null;
  const mediaRevision =
    user?.profile_media_revision || user?.profileMediaRevision || 1;
  const [securePhotoUrl, setSecurePhotoUrl] = useState(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const initials = initialsFor(user);

  useEffect(() => {
    const refresh = (event) => { if (Number(event.detail?.userId) === Number(user?.id)) setRefreshRevision(Number(event.detail?.revision) || Date.now()); };
    window.addEventListener("atd:profile-avatar-changed", refresh);
    return () => window.removeEventListener("atd:profile-avatar-changed", refresh);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    setSecurePhotoUrl(null);
    setImageFailed(false);

    if (!user?.id) return undefined;

    const loadSecureAvatar = async () => {
      try {
        const metadataResponse = await profileMediaApi.metadata(user.id, "avatar");
        const media = metadataResponse?.data?.media;
        if (!media) return;
        const response = await profileMediaApi.download(
          user.id,
          "avatar",
          media.revision || mediaRevision
        );
        if (!active || !response?.data) return;
        objectUrl = URL.createObjectURL(response.data);
        setSecurePhotoUrl(objectUrl);
      } catch (error) {
        const status = error?.response?.status;
        if (![401, 403, 404].includes(status)) {
          console.warn("Unable to load secure profile avatar.", error);
        }
      }
    };

    loadSecureAvatar();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, mediaRevision, refreshRevision]);

  const photoUrl = securePhotoUrl || fallbackPhotoUrl;

  useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  if (photoUrl && !imageFailed) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={classNames(
          "h-9 w-9 rounded-full object-cover ring-1 ring-slate-200",
          imageClassName,
          className
        )}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className={classNames(
        "flex h-9 w-9 items-center justify-center rounded-full portal-accent-fill bg-[var(--portal-primary)] text-xs font-bold text-white",
        className
      )}
      aria-hidden="true"
    >
      {initials || <UserCircle className="h-5 w-5" />}
    </span>
  );
}