import { toast } from "react-toastify";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
import React from "react";

export const showSuccess = (message) =>
  toast.success(
    <div className="flex items-center space-x-2">
      <FaCheckCircle className="text-green-600" />
      <span>{message}</span>
    </div>
  );

export const showError = (message) =>
  toast.error(
    <div className="flex items-center space-x-2">
      <FaTimesCircle className="text-red-600" />
      <span>{message}</span>
    </div>
  );

export const showWarning = (message) =>
  toast.warn(
    <div className="flex items-center space-x-2">
      <FaExclamationTriangle className="text-yellow-500" />
      <span>{message}</span>
    </div>
  );

export const showInfo = (message) =>
  toast.info(
    <div className="flex items-center space-x-2">
      <FaInfoCircle className="text-blue-600" />
      <span>{message}</span>
    </div>
  );
