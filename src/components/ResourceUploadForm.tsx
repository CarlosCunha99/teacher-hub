"use client";

import { FormEvent, useState, ChangeEvent } from "react";
import { SUBJECT_OPTIONS, YEAR_LEVEL_OPTIONS } from "@/lib/resources";
import { validatePDFFile, PDFValidationError, PDF_VALIDATION_LIMITS } from "@/lib/pdf-validation";

interface ResourceUploadFormProps {
  onSuccess?: (resourceId: string) => void;
  onError?: (error: Error) => void;
}

interface FormData {
  title: string;
  description: string;
  subject: string;
  yearLevel: string;
  file: File | null;
}

interface FormErrors {
  title?: string;
  description?: string;
  subject?: string;
  yearLevel?: string;
  file?: string;
  submission?: string;
}

export default function ResourceUploadForm({ onSuccess, onError }: ResourceUploadFormProps) {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    subject: SUBJECT_OPTIONS[0],
    yearLevel: YEAR_LEVEL_OPTIONS[0],
    file: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required.";
    } else if (formData.title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters.";
    } else if (formData.title.trim().length > 200) {
      newErrors.title = "Title cannot exceed 200 characters.";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required.";
    } else if (formData.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters.";
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = "Description cannot exceed 2000 characters.";
    }

    if (!formData.subject || formData.subject === "") {
      newErrors.subject = "Please select a subject.";
    }

    if (!formData.yearLevel || formData.yearLevel === "") {
      newErrors.yearLevel = "Please select a year level.";
    }

    if (!formData.file) {
      newErrors.file = "Please select a PDF file.";
    } else {
      try {
        validatePDFFile(formData.file);
      } catch (error) {
        if (error instanceof PDFValidationError) {
          newErrors.file = error.message;
        } else {
          newErrors.file = "Invalid PDF file.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      file,
    }));
    setSelectedFileName(file?.name || "");
    if (errors.file) {
      setErrors((prev) => ({
        ...prev,
        file: undefined,
      }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title.trim());
      formDataToSend.append("description", formData.description.trim());
      formDataToSend.append("subject", formData.subject);
      formDataToSend.append("yearLevel", formData.yearLevel);
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      }

      const response = await fetch("/api/resources", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload resource. Please try again.");
      }

      const result = await response.json();

      setFormData({
        title: "",
        description: "",
        subject: SUBJECT_OPTIONS[0],
        yearLevel: YEAR_LEVEL_OPTIONS[0],
        file: null,
      });
      setSelectedFileName("");

      if (onSuccess) {
        onSuccess(result.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setErrors((prev) => ({
        ...prev,
        submission: errorMessage,
      }));

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Upload new resource">
      {errors.submission && (
        <div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
          {errors.submission}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="title">
          Title <span aria-label="required">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleInputChange}
          disabled={isSubmitting}
          maxLength={200}
          required
        />
        {errors.title && <div style={{ color: "red", fontSize: "0.875rem" }}>{errors.title}</div>}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="description">
          Description <span aria-label="required">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          disabled={isSubmitting}
          maxLength={2000}
          rows={5}
          required
        />
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          {formData.description.length}/2000 characters
        </div>
        {errors.description && (
          <div style={{ color: "red", fontSize: "0.875rem" }}>{errors.description}</div>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="subject">
          Subject <span aria-label="required">*</span>
        </label>
        <select
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleInputChange}
          disabled={isSubmitting}
          required
        >
          <option value="">Select a subject</option>
          {SUBJECT_OPTIONS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
        {errors.subject && (
          <div style={{ color: "red", fontSize: "0.875rem" }}>{errors.subject}</div>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="yearLevel">
          Year Level <span aria-label="required">*</span>
        </label>
        <select
          id="yearLevel"
          name="yearLevel"
          value={formData.yearLevel}
          onChange={handleInputChange}
          disabled={isSubmitting}
          required
        >
          <option value="">Select a year level</option>
          {YEAR_LEVEL_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.yearLevel && (
          <div style={{ color: "red", fontSize: "0.875rem" }}>{errors.yearLevel}</div>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="file">
          PDF File <span aria-label="required">*</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={isSubmitting}
          required
        />
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          Maximum file size: {PDF_VALIDATION_LIMITS.maxFileSizeMB}MB
          {selectedFileName && ` — ${selectedFileName}`}
        </div>
        {errors.file && <div style={{ color: "red", fontSize: "0.875rem" }}>{errors.file}</div>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Publish Resource"}
      </button>
    </form>
  );
}
