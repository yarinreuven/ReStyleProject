import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:3001/api/marketplace";
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

const initialForm = {
  name: "",
  description: "",
  category: "Tops",
  brand: "",
  size: "",
  condition: "Like New",
  listingType: "sale",
  price: "",
  rentalPricePerDay: ""
};

function validate(form, images) {
  const errors = {};
  const selectedPrice = form.listingType === "sale"
    ? form.price
    : form.rentalPricePerDay;

  if (form.name.trim().length < 2) errors.name = "Enter at least 2 characters.";
  if (form.description.trim().length < 10) {
    errors.description = "Enter a description of at least 10 characters.";
  }
  if (!form.brand.trim()) errors.brand = "Brand is required.";
  if (!form.size.trim()) errors.size = "Size is required.";
  if (!selectedPrice || Number(selectedPrice) <= 0) {
    errors.price = "Enter a price greater than 0.";
  }
  if (images.length === 0) errors.images = "Add at least one image.";
  if (images.length > MAX_IMAGES) errors.images = "You can add up to 4 images.";

  return errors;
}

export default function MarketplaceListingForm({ token, onClose, onPublished }) {
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images]
  );

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const nextErrors = { ...current, [name]: "" };
      if (name === "listingType" || name === "price" || name === "rentalPricePerDay") {
        nextErrors.price = "";
      }
      return nextErrors;
    });
  }

  function chooseImages(event) {
    const selectedImages = Array.from(event.target.files || []);
    const invalidType = selectedImages.some((file) => !acceptedImageTypes.includes(file.type));
    const oversized = selectedImages.some((file) => file.size > MAX_IMAGE_SIZE);

    if (selectedImages.length > MAX_IMAGES) {
      setErrors((current) => ({ ...current, images: "You can add up to 4 images." }));
      event.target.value = "";
      return;
    }
    if (invalidType) {
      setErrors((current) => ({ ...current, images: "Use JPG, PNG or WEBP images only." }));
      event.target.value = "";
      return;
    }
    if (oversized) {
      setErrors((current) => ({ ...current, images: "Each image must be no larger than 5MB." }));
      event.target.value = "";
      return;
    }

    setImages(selectedImages);
    setErrors((current) => ({ ...current, images: "" }));
  }

  function removeImage(indexToRemove) {
    setImages((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async function submitListing(event) {
    event.preventDefault();
    const validationErrors = validate(form, images);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      const payload = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (key === "price" && form.listingType !== "sale") return;
        if (key === "rentalPricePerDay" && form.listingType !== "rent") return;
        payload.append(key, value);
      });
      images.forEach((image) => payload.append("images", image));

      const { data } = await axios.post(API_URL, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onPublished(data.item);
    } catch (error) {
      setSubmitError(
        error.response?.data?.message || "Could not publish your listing. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSale = form.listingType === "sale";

  return (
    <div className="market-listing-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    }}>
      <section className="market-listing-modal" role="dialog" aria-modal="true" aria-labelledby="listingFormTitle">
        <header>
          <div>
            <span>SHARE FROM YOUR WARDROBE</span>
            <h2 id="listingFormTitle">Add a listing</h2>
            <p>Your account will automatically be shown as the seller.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close form">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submitListing} noValidate>
          <fieldset className="market-listing-type">
            <legend>How would you like to offer it?</legend>
            <label className={isSale ? "active" : ""}>
              <input type="radio" name="listingType" value="sale" checked={isSale} onChange={updateField} />
              <i className="fa-solid fa-tag" aria-hidden="true" />
              <span><strong>For Sale</strong><small>Sell this piece</small></span>
            </label>
            <label className={!isSale ? "active" : ""}>
              <input type="radio" name="listingType" value="rent" checked={!isSale} onChange={updateField} />
              <i className="fa-regular fa-calendar" aria-hidden="true" />
              <span><strong>For Rent</strong><small>Set a daily price</small></span>
            </label>
          </fieldset>

          <div className="market-listing-grid">
            <label className="market-form-field market-form-wide">
              <span>Item name</span>
              <input name="name" value={form.name} onChange={updateField} placeholder="e.g. Linen summer blazer" maxLength="80" />
              {errors.name && <small className="market-field-error">{errors.name}</small>}
            </label>

            <label className="market-form-field">
              <span>Category</span>
              <select name="category" value={form.category} onChange={updateField}>
                {['Tops', 'Bottoms', 'Dresses', 'Jackets', 'Shoes', 'Bags', 'Accessories'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="market-form-field">
              <span>Brand</span>
              <input name="brand" value={form.brand} onChange={updateField} placeholder="Brand name" maxLength="80" />
              {errors.brand && <small className="market-field-error">{errors.brand}</small>}
            </label>

            <label className="market-form-field">
              <span>Size</span>
              <input name="size" value={form.size} onChange={updateField} placeholder="e.g. M, 38, One size" maxLength="30" />
              {errors.size && <small className="market-field-error">{errors.size}</small>}
            </label>

            <label className="market-form-field">
              <span>Condition</span>
              <select name="condition" value={form.condition} onChange={updateField}>
                {['New', 'Like New', 'Excellent', 'Good', 'Fair'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="market-form-field market-form-wide">
              <span>{isSale ? "Sale price" : "Rental price per day"}</span>
              <div className="market-price-input">
                <b>₪</b>
                <input
                  type="number"
                  name={isSale ? "price" : "rentalPricePerDay"}
                  min="0.01"
                  step="0.01"
                  value={isSale ? form.price : form.rentalPricePerDay}
                  onChange={updateField}
                  placeholder="0"
                />
                {!isSale && <em>/ day</em>}
              </div>
              {errors.price && <small className="market-field-error">{errors.price}</small>}
            </label>

            <label className="market-form-field market-form-wide">
              <span>Description</span>
              <textarea name="description" value={form.description} onChange={updateField} placeholder="Describe the item, fit and any useful details..." maxLength="1000" rows="4" />
              <small className={errors.description ? "market-field-error" : "market-field-hint"}>
                {errors.description || `${form.description.length}/1000`}
              </small>
            </label>

            <div className="market-image-field market-form-wide">
              <span>Photos <small>1–4 images, up to 5MB each</small></span>
              <label className="market-image-picker">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} />
                <i className="fa-regular fa-images" aria-hidden="true" />
                <strong>Choose item photos</strong>
                <small>JPG, PNG or WEBP</small>
              </label>
              {errors.images && <small className="market-field-error">{errors.images}</small>}
              {previews.length > 0 && (
                <div className="market-image-previews">
                  {previews.map((preview, index) => (
                    <div key={`${preview.file.name}-${preview.file.lastModified}`}>
                      <img src={preview.url} alt={`Selected item ${index + 1}`} />
                      <button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {submitError && <p className="market-submit-error" role="alert">{submitError}</p>}

          <footer>
            <button type="button" className="market-listing-cancel" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="market-listing-submit" disabled={isSubmitting}>
              {isSubmitting ? <><span className="market-button-spinner" /> Publishing...</> : <><i className="fa-solid fa-plus" /> Publish listing</>}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
