import React, { useState, useRef } from "react";
import { Upload, FileCode, AlertCircle, X, CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface FormData {
    name: string;
    class: string;
    section: string;
}

interface UploadedFile {
    file: File;
    name: string;
    size: string;
}

function SubmissionForm() {
    const [formData, setFormData] = useState<FormData>({
        name: "",
        class: "",
        section: "",
    });
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [errors, setErrors] = useState<Partial<FormData & { file: string }>>(
        {}
    );
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ✅ Helpers
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
        );
    };

    const validateFile = (file: File): boolean => {
        if (!file.name.endsWith(".py")) {
            setErrors((prev) => ({
                ...prev,
                file: "Only Python (.py) files are allowed",
            }));
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrors((prev) => ({
                ...prev,
                file: "File size must be less than 5MB",
            }));
            return false;
        }
        return true;
    };

    const handleFileSelect = (file: File) => {
        if (validateFile(file)) {
            setUploadedFile({
                file,
                name: file.name,
                size: formatFileSize(file.size),
            });
            setErrors((prev) => ({ ...prev, file: "" }));
        }
    };

    // ✅ Drag & Drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    // ✅ File Input
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const removeFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // ✅ Form validation
    const validateForm = (): boolean => {
        const newErrors: Partial<FormData & { file: string }> = {};
        if (!formData.name.trim()) newErrors.name = "Name is required";
        if (!formData.class.trim()) newErrors.class = "Class is required";
        if (!formData.section.trim()) newErrors.section = "Section is required";
        if (!uploadedFile) newErrors.file = "Python file is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormData]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    // ✅ Submit Handler
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !uploadedFile) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
        const { name, class: cls, section } = formData;
        const fileName = uploadedFile.name;
        const ext = fileName.split(".").pop()?.toLowerCase();

        // ✅ Build storage file name & folder structure
        const storageFileName = `${name}_${cls}_${section}_${fileName}`;
        const filePath = `${cls}/${section}/${storageFileName}`;

        // ✅ Check DB for duplicate
        const { data: existing, error: fetchError } = await supabase
            .from("submissions")
            .select("id")
            .eq("student_name", name)
            .eq("class", cls)
            .eq("section", section)
            .eq("filename", fileName);

        if (fetchError) {
            console.error("DB fetch error:", fetchError);
            setErrorMessage("Failed to validate submission. Try again.");
            setIsSubmitting(false);
            return; // 🚨 stop
        }

        if (existing && existing.length > 0) {
            setErrorMessage("File already exists. Contact your teacher for resubmission.");
            setIsSubmitting(false);
            return; // 🚨 stop
        }

        // ✅ Upload file folder-wise
        const { error: uploadError } = await supabase.storage
            .from("submissions")
            .upload(filePath, uploadedFile.file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            setErrorMessage(
                uploadError.message.includes("exists")
                    ? "File already exists. Contact your teacher for resubmission."
                    : "Upload failed. Please try again."
            );
            setIsSubmitting(false);
            return; // 🚨 stop
        }

        // ✅ Generate public URL manually
        const fileURL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/submissions/${filePath}`;

        // ✅ Insert record in DB
        const { error: insertError } = await supabase.from("submissions").insert([
            {
                student_name: name,
                class: cls,
                section,
                filename: fileName,
                extension: ext,
                file_url: fileURL,
                file_path: filePath, // ✅ store path for reference
            },
        ]);

        if (insertError) {
            console.error("DB insert error:", insertError);
            setErrorMessage("Upload succeeded, but saving submission failed.");
            setIsSubmitting(false);
            return; // 🚨 stop
        }

        // ✅ Success case only
        setSuccessMessage("✅ Submission successful!");
        setUploadedFile(null);
        setFormData({ name: "", class: "", section: "" });
        if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
        console.error("Unexpected error:", err);
        setErrorMessage("Upload failed. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
};


    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
            {/* Banner */}
            <div className="bg-blue-800 text-white text-center py-4 rounded-xl shadow-md mb-6">
                <h1 className="text-2xl font-bold">
                    Sri Sathya Sai Vidya Vihar, Gail Vijaypur
                </h1>
            </div>

            {/* Floating Success Message */}
            {successMessage && (
                <div className="fixed top-6 right-6 bg-white shadow-xl rounded-xl p-4 border border-green-300 z-50 w-80">
                    <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-green-600 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {successMessage}
                        </p>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="text-gray-400 hover:text-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Error Message */}
            {errorMessage && (
                <div className="fixed top-6 right-6 bg-white shadow-xl rounded-xl p-4 border border-red-300 z-50 w-80">
                    <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-red-600 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errorMessage}
                        </p>
                        <button
                            onClick={() => setErrorMessage(null)}
                            className="text-gray-400 hover:text-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Student Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Student Name */}
                            <div>
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Student Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                                        errors.name
                                            ? "border-red-300"
                                            : "border-gray-200"
                                    } focus:outline-none focus:border-blue-500`}
                                    placeholder="Enter your full name"
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-600">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            {/* Class Dropdown */}
                            <div>
                                <label
                                    htmlFor="class"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Class *
                                </label>
                                <select
                                    id="class"
                                    name="class"
                                    value={formData.class}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                                        errors.class
                                            ? "border-red-300"
                                            : "border-gray-200"
                                    } focus:outline-none focus:border-blue-500`}
                                >
                                    <option value="">Select Class</option>
                                    {["6th", "7th", "8th", "9th", "10th"].map(
                                        (c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        )
                                    )}
                                </select>
                                {errors.class && (
                                    <p className="text-sm text-red-600">
                                        {errors.class}
                                    </p>
                                )}
                            </div>

                            {/* Section Dropdown */}
                            <div>
                                <label
                                    htmlFor="section"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Section *
                                </label>
                                <select
                                    id="section"
                                    name="section"
                                    value={formData.section}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 rounded-lg border-2 ${
                                        errors.section
                                            ? "border-red-300"
                                            : "border-gray-200"
                                    } focus:outline-none focus:border-blue-500`}
                                >
                                    <option value="">Select Section</option>
                                    {["A", "B", "C"].map((sec) => (
                                        <option key={sec} value={sec}>
                                            {sec}
                                        </option>
                                    ))}
                                </select>
                                {errors.section && (
                                    <p className="text-sm text-red-600">
                                        {errors.section}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Python File Upload *
                            </label>
                            <div
                                className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
                                    isDragOver
                                        ? "border-blue-400 bg-blue-50"
                                        : errors.file
                                        ? "border-red-300 bg-red-50"
                                        : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".py"
                                    onChange={handleFileInputChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {uploadedFile ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
                                            <FileCode className="w-8 h-8 text-green-600" />
                                        </div>
                                        <p className="font-semibold">
                                            {uploadedFile.name}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {uploadedFile.size}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={removeFile}
                                            className="text-red-600 text-sm flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4 mr-1" /> Remove
                                            file
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto">
                                            <Upload className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-semibold text-gray-700">
                                            Drop your Python file here
                                        </p>
                                        <p className="text-gray-500">
                                            or click to browse (.py files only,
                                            max 5MB)
                                        </p>
                                    </div>
                                )}
                            </div>
                            {errors.file && (
                                <p className="text-sm text-red-600 mt-2">
                                    {errors.file}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Submitting..." : "Submit Assignment"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default SubmissionForm;