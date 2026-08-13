import { useEffect, useState } from "react";
import axios from "axios";

const PROFILE_IMAGE_URL =
  "http://localhost:3001/api/auth/profile-image";

export default function ProfileAvatar({ token, user, size = "normal" }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!token || !user?.hasProfileImage) {
      setImageUrl("");
      return undefined;
    }

    let objectUrl = "";
    let cancelled = false;

    axios
      .get(`${PROFILE_IMAGE_URL}?user=${encodeURIComponent(user.id)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: "blob",
        params: {
          updated: user.profileImageUpdatedAt || "current"
        }
      })
      .then(({ data }) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(data);
        setImageUrl(objectUrl);
      })
      .catch(() => setImageUrl(""));

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, user?.id, user?.hasProfileImage, user?.profileImageUpdatedAt]);

  if (imageUrl) {
    return (
      <img
        className={`profile-avatar profile-avatar-${size}`}
        src={imageUrl}
        alt={`${user.firstName}'s profile`}
      />
    );
  }

  return (
    <span className={`profile-avatar profile-avatar-${size} avatar-fallback`}>
      {user?.firstName?.charAt(0).toUpperCase() || "?"}
    </span>
  );
}
