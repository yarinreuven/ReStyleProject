import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import useAuthorizationConfig from "../hooks/useAuthorizationConfig";

const PROFILE_IMAGE_URL =
  `${API_BASE_URL}/auth/profile-image`;

export default function ProfileAvatar({ token, user, size = "normal" }) {
  const [imageUrl, setImageUrl] = useState("");
  const requestConfig = useAuthorizationConfig(token);

  useEffect(() => {
    if (!token || !user?.hasProfileImage) {
      setImageUrl("");
      return undefined;
    }

    let objectUrl = "";
    let cancelled = false;

    axios
      .get(`${PROFILE_IMAGE_URL}?user=${encodeURIComponent(user.id)}`, {
        ...requestConfig,
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
  }, [requestConfig, token, user?.id, user?.hasProfileImage, user?.profileImageUpdatedAt]);

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
