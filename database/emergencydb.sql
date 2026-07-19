-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 19, 2026 at 11:40 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.5.7

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `emergencydb`
--

-- --------------------------------------------------------

--
-- Table structure for table `barangays`
--

CREATE TABLE `barangays` (
  `barangay_id` int(11) NOT NULL,
  `barangay_name` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `barangays`
--

INSERT INTO `barangays` (`barangay_id`, `barangay_name`) VALUES
(1, 'Alua'),
(2, 'Calaba'),
(3, 'Malapit'),
(4, 'Mangga'),
(5, 'Poblacion'),
(6, 'Pulo'),
(7, 'San Roque'),
(8, 'Santo Cristo'),
(9, 'Tabon');

-- --------------------------------------------------------

--
-- Table structure for table `broadcasts`
--

CREATE TABLE `broadcasts` (
  `broadcast_id` int(11) NOT NULL,
  `message` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `broadcasts`
--

INSERT INTO `broadcasts` (`broadcast_id`, `message`, `is_active`, `created_at`) VALUES
(1, 'Evacuate now', 0, '2026-05-09 21:21:36');

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `device_tokens`
--

CREATE TABLE `device_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `platform` varchar(20) DEFAULT 'android',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `device_tokens`
--

INSERT INTO `device_tokens` (`id`, `user_id`, `token`, `platform`, `created_at`) VALUES
(1, 1, 'eVqOLncBQ8iGuCeHD2Ny_z:APA91bE1rJnMAzVBVWXVPz3f7e5B482W-Ve5AYS24INoGzKH4CclbwOVEpnUa2J7jcR6vgC0cHaSzEpCe-uHacDt7uMGVOQBu0GudTXglalWV_xVbwuMgOM', 'android', '2026-07-11 18:40:56'),
(2, 1, 'fjy_2PU0SEuQvXfoFDGho6:APA91bHep5qrZclAUkex_kIL1ZjD4KTc7DLdsWLhYDWrH9N78eiBZyVBO4pHInA4Rpo3xMh9SkAhaf5MJGg_D2pQiONmfyehl8gsiuto5ZXpedJIp94eIAY', 'android', '2026-07-12 04:11:36'),
(3, 1, 'dpUkNfsdT3OcF38v3xhNvN:APA91bGwNqq6hlwRJj4A_NLUru_BVHnpXWhS3LHxWMi5LZ6BmqYsomZlqk3MpQxa2z6LV77bHtZqLh30hwcBuF0ChX9gd0NfaAECSK1VofmFnA-R8t9z5T4', 'android', '2026-07-12 11:17:55'),
(4, 1, 'ctB8DfSuRH-nVatqa6xsRI:APA91bEB_0Aax65H_THShGkbS3RIFGnIL-UtaNY23WrHPs8-iSdPP6ssI367zBUzNfr2gtr0cKS5yWTTR781PocdkaozeW8DhexiHg1MtP7f9WQeNYzmJ18', 'android', '2026-07-12 11:54:34'),
(5, 1, 'df7OxtlUSp-3xSyrSi_m08:APA91bHtY2POYlAvo7IMdSP1lAkVRQYt8vagY-t0vnpOETwGVZnem4ep54T8B3gsfRHQWqBaFKfMVMgXljM3CqEIFqvYwl6tdXgCqYF9sMqB3qzGvwGh-Jg', 'android', '2026-07-14 05:24:38'),
(6, 1, 'fx2cuP45TXqKJsNNVANsC_:APA91bFdRIvVz0q7nsKwfIB1Qkt2BX_dID7spj7JV_Eo7K5dNKjbzCYPLEjtnCDjTm_Q8dGi8P4Xee4C8sAXGmYTMhtbjB8RDPl0Mz8FhTxOMjQoRm8T1w8', 'android', '2026-07-17 03:53:41'),
(7, 1, 'cHJMmcCUTh2Evr4n1Q-WCM:APA91bEuKd2QRnhUohuQhJFkcNZNoZ8_DyfjAI65rGsQjoFj1XzmgR7ToiTXe-b6X2f-aF5_7yDrt17JcqNMUceIBr2STYexFgICIeTse5PcICZInNqo9CI', 'android', '2026-07-17 11:44:28'),
(8, 1, 'cet-Zg8QQSeqvUGd-BOnmF:APA91bF_LyJ7oHO5ZjOhM9-d5FpZuiFVYsXeKWoREdsWnHRJY2NSrNeaSG7BkvaOz9fZCAcSgIo7Zw5O7Cp683GvXyukn2RWwg1d8VnI6uILJnX4ztLSi-Y', 'android', '2026-07-17 19:42:15'),
(9, 1, 'e8nunFLhQbKA_27d9VLaUe:APA91bE0kOyvk8M4nolSXNd1WgnN1IHCBQOheu7R0NoyClU6FEylC7ZQTSCZp3PSWCryT7rs-HXsfgO-1xaaOKj9yfImYaPz1yAnmvCk7pKkquwRXbxUHEY', 'android', '2026-07-18 04:39:59');

-- --------------------------------------------------------

--
-- Table structure for table `dispatch`
--

CREATE TABLE `dispatch` (
  `dispatch_id` int(11) NOT NULL,
  `request_id` int(11) DEFAULT NULL,
  `responder_id` int(11) DEFAULT NULL,
  `vehicle_id` int(11) DEFAULT NULL,
  `dispatch_time` datetime DEFAULT NULL,
  `arrival_time` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dispatch`
--

INSERT INTO `dispatch` (`dispatch_id`, `request_id`, `responder_id`, `vehicle_id`, `dispatch_time`, `arrival_time`, `status`) VALUES
(1, 4, 2, 2, '2026-06-13 09:41:33', '2026-06-13 09:43:20', 'Completed'),
(2, 8, 4, 3, '2026-06-13 09:44:55', '2026-06-13 09:46:23', 'Completed');

-- --------------------------------------------------------

--
-- Table structure for table `emergency_requests`
--

CREATE TABLE `emergency_requests` (
  `request_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `incident_type_id` int(11) DEFAULT NULL,
  `proof_files` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`proof_files`)),
  `description` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `request_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_false_alarm` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `emergency_requests`
--

INSERT INTO `emergency_requests` (`request_id`, `user_id`, `incident_type_id`, `proof_files`, `description`, `latitude`, `longitude`, `status`, `request_time`, `created_at`, `updated_at`, `deleted_at`, `is_false_alarm`) VALUES
(3, 1, 3, NULL, NULL, 15.30542100, 120.91368200, 'Cancelled', '2026-05-08 02:46:44', '2026-05-08 02:46:44', '2026-05-08 07:18:13', NULL, 0),
(4, 3, 4, '[\"storage/emergencies/sos_1778388008_3.png\"]', NULL, 15.27727200, 120.90597900, 'Resolved', '2026-05-09 20:40:08', '2026-05-09 20:40:08', '2026-06-14 02:40:38', NULL, 0),
(5, 1, 1, '[\"storage/emergencies/sos_1778388059_1.png\"]', NULL, 15.29416200, 120.90593600, 'Cancelled', '2026-05-09 20:40:59', '2026-05-09 20:40:59', '2026-06-14 02:40:38', NULL, 0),
(6, 1, 2, '[\"storage/emergencies/sos_20260611_094105_1.mp4\"]', NULL, 15.22605500, 120.90042100, 'Cancelled', '2026-06-11 01:41:05', '2026-06-11 01:41:05', '2026-06-14 02:40:38', NULL, 0),
(7, 1, 2, '[\"storage/emergencies/sos_20260613_093824_1.png\"]', NULL, 15.30950500, 120.90758600, 'Cancelled', '2026-06-13 01:38:24', '2026-06-13 01:38:24', '2026-06-14 02:40:38', NULL, 0),
(8, 3, 3, '[\"storage/emergencies/sos_20260613_094422_3.png\"]', NULL, 15.30951900, 120.90291000, 'Resolved', '2026-06-13 01:44:22', '2026-06-13 01:44:22', '2026-06-14 02:40:38', NULL, 0),
(9, 1, 2, '[\"storage\\/emergencies\\/sos_20260629_105213_6a424e5d615d6_1.png\",\"storage\\/emergencies\\/sos_20260629_105213_6a424e5d6675b_1.mp4\"]', NULL, 15.26077600, 120.91049400, 'Pending', '2026-06-29 02:52:13', '2026-06-29 02:52:13', '2026-06-29 02:52:13', NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `feedback`
--

CREATE TABLE `feedback` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `category` varchar(50) DEFAULT 'general',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hazards`
--

CREATE TABLE `hazards` (
  `hazard_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `hazard_type` varchar(50) DEFAULT NULL,
  `proof_files` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`proof_files`)),
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hazards`
--

INSERT INTO `hazards` (`hazard_id`, `user_id`, `description`, `hazard_type`, `proof_files`, `latitude`, `longitude`, `status`, `created_at`, `updated_at`) VALUES
(1, 3, 'Broken Road', NULL, '[\"storage/emergencies/hazard_1778387633_3.png\"]', 15.27789300, 120.90927300, 'Resolved', '2026-05-09 20:33:53', '2026-06-14 02:40:38'),
(2, 1, 'baha', 'Flooded Street', '[\"storage/emergencies/hazard_20260613_093939_1.mp4\"]', 15.29582200, 120.88609000, 'Resolved', '2026-06-13 01:39:39', '2026-06-14 02:40:38');

-- --------------------------------------------------------

--
-- Table structure for table `incident_types`
--

CREATE TABLE `incident_types` (
  `incident_type_id` int(11) NOT NULL,
  `incident_name` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `incident_types`
--

INSERT INTO `incident_types` (`incident_type_id`, `incident_name`) VALUES
(1, 'Fire'),
(2, 'Flood'),
(3, 'Medical'),
(4, 'Crime'),
(5, 'Others');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(12, '0001_01_01_000000_create_users_table', 1),
(13, '0001_01_01_000001_create_cache_table', 1),
(14, '0001_01_01_000002_create_jobs_table', 1),
(15, '2026_07_05_025058_create_user_settings_table', 1);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(7, 'App\\Models\\User', 1, 'app-token', '7130a0fa04721df10709f295771d9793632cc4bdbb4805c2cf51ca0cb3bf5743', '[\"citizen\"]', '2026-07-19 00:51:57', NULL, '2026-07-18 04:46:15', '2026-07-19 00:51:57');

-- --------------------------------------------------------

--
-- Table structure for table `responders`
--

CREATE TABLE `responders` (
  `responder_id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `contact` varchar(20) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `responders`
--

INSERT INTO `responders` (`responder_id`, `name`, `role`, `contact`, `status`) VALUES
(1, 'San Isidro BFP', 'Firefighter', '09111111111', 'Available'),
(2, 'San Isidro PNP', 'Police', '09222222222', 'Available'),
(3, 'MDRRMO Rescue Team', 'Rescue', '09333333333', 'Available'),
(4, 'Rural Health Unit (RHU)', 'Medical', '09444444444', 'Available');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT 'https://ionicframework.com/docs/img/demos/avatar.svg',
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` enum('citizen','dispatcher','admin') NOT NULL DEFAULT 'citizen',
  `account_status` enum('active','banned') NOT NULL DEFAULT 'active',
  `barangay_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `valid_id_proof` varchar(255) DEFAULT NULL,
  `blood_type` varchar(10) DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `medical_conditions` text DEFAULT NULL,
  `pwd_status` varchar(100) DEFAULT NULL,
  `ban_reason` varchar(500) DEFAULT NULL,
  `banned_at` timestamp NULL DEFAULT NULL,
  `false_alarm_strikes` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `first_name`, `last_name`, `username`, `phone`, `birthdate`, `profile_picture`, `email`, `password`, `role`, `account_status`, `barangay_id`, `created_at`, `updated_at`, `deleted_at`, `valid_id_proof`, `blood_type`, `allergies`, `medical_conditions`, `pwd_status`, `ban_reason`, `banned_at`, `false_alarm_strikes`) VALUES
(1, 'Emmanuel John', 'Perez', 'user1', '09123456789', NULL, 'storage/profiles/profile_1784451005_1.png', 'ejperez623@gmail.com', '$2y$12$tf9EDu5GrXqwEi0Mu8KZau/9MnLwEYanOtozFMKQ6Wfs7OPK29U0a', 'citizen', 'active', 9, '2026-05-07 05:45:17', '2026-07-19 08:51:57', NULL, NULL, 'AB+', 'shrimp', '', '', NULL, NULL, 0),
(3, 'Emmanuel', 'Perezzz', 'user2', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'ejperez634@gmail.com', '$2y$12$rEM8co2YcwxaGgxRDZkzzu372zNnL1J8UzVfXdykwnGXuFB0SkoRe', 'citizen', 'active', 1, '2026-05-07 05:45:17', '2026-05-07 17:33:20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
(4, 'admin_user', 'Admin', 'admin', 'N/A', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'admin_user@sine.gov.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', 1, '2026-05-07 05:45:17', '2026-05-07 17:31:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
(8, 'Dispatcher 1', '1', 'dispatcher1', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'dis@mail.com', '$2y$12$7O1Kw6owYNV9D5wcfJxs5./mGMgpzOYv06Ipi1D4XoxsoiHNwuZ8O', 'dispatcher', 'active', 3, '2026-05-07 16:23:26', '2026-05-08 08:52:34', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
(9, 'dispatcher', '2', 'dispatcher2', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'dis2@mail.com', '$2y$12$WuAbG0j2AFQjlMC/RttG4OF5qv2k372lv6qeIOfjJue5FnBJ8Eml.', 'dispatcher', 'active', 4, '2026-05-08 09:28:54', '2026-05-08 09:28:54', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
(10, 'awd', 'awd', 'awdawd', '131314', '2005-04-13', 'https://ionicframework.com/docs/img/demos/avatar.svg', 'ejcp2005@gmail.com', '$2y$12$C5EMGU7mvVIrkGD9VIn.PuKexBvLz4taR/.KJMRLn2qSw4dBlNFpW', 'citizen', 'active', 5, '2026-05-10 12:07:56', '2026-05-10 12:07:56', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_settings`
--

CREATE TABLE `user_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `key` varchar(64) NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_settings`
--

INSERT INTO `user_settings` (`id`, `user_id`, `key`, `value`, `updated_at`) VALUES
(1, 1, 'dark_mode', 'true', '2026-07-12 04:58:47'),
(2, 1, 'location_auto_fetch', 'true', '2026-07-17 03:54:38'),
(3, 1, 'map_default_style', 'satellite', '2026-07-17 03:54:27'),
(4, 1, 'reduce_animations', 'false', '2026-07-17 03:54:18');

-- --------------------------------------------------------

--
-- Table structure for table `vehicles`
--

CREATE TABLE `vehicles` (
  `vehicle_id` int(11) NOT NULL,
  `responder_id` int(11) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `plate` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vehicles`
--

INSERT INTO `vehicles` (`vehicle_id`, `responder_id`, `name`, `type`, `plate`, `status`) VALUES
(1, 1, 'Firetruck 01', 'Truck', 'SFP-123', 'Available'),
(2, 2, 'Police Patrol Alpha', 'Car', 'PNP-456', 'Available'),
(3, 4, 'Rescue Ambulance A', 'Ambulance', 'MDR-789', 'Available'),
(4, 3, 'Rescue Boat 1', 'Boat', 'MDR-001', 'Available');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `barangays`
--
ALTER TABLE `barangays`
  ADD PRIMARY KEY (`barangay_id`);

--
-- Indexes for table `broadcasts`
--
ALTER TABLE `broadcasts`
  ADD PRIMARY KEY (`broadcast_id`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `device_tokens`
--
ALTER TABLE `device_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_token` (`token`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `dispatch`
--
ALTER TABLE `dispatch`
  ADD PRIMARY KEY (`dispatch_id`);

--
-- Indexes for table `emergency_requests`
--
ALTER TABLE `emergency_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `incident_type_id` (`incident_type_id`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `feedback`
--
ALTER TABLE `feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `feedback_user_id_foreign` (`user_id`);

--
-- Indexes for table `hazards`
--
ALTER TABLE `hazards`
  ADD PRIMARY KEY (`hazard_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `incident_types`
--
ALTER TABLE `incident_types`
  ADD PRIMARY KEY (`incident_type_id`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`);

--
-- Indexes for table `responders`
--
ALTER TABLE `responders`
  ADD PRIMARY KEY (`responder_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `barangay_id` (`barangay_id`);

--
-- Indexes for table `user_settings`
--
ALTER TABLE `user_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_settings_user_id_key_unique` (`user_id`,`key`);

--
-- Indexes for table `vehicles`
--
ALTER TABLE `vehicles`
  ADD PRIMARY KEY (`vehicle_id`),
  ADD KEY `fk_vehicle_responder` (`responder_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `barangays`
--
ALTER TABLE `barangays`
  MODIFY `barangay_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `broadcasts`
--
ALTER TABLE `broadcasts`
  MODIFY `broadcast_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `device_tokens`
--
ALTER TABLE `device_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `dispatch`
--
ALTER TABLE `dispatch`
  MODIFY `dispatch_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `emergency_requests`
--
ALTER TABLE `emergency_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `feedback`
--
ALTER TABLE `feedback`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hazards`
--
ALTER TABLE `hazards`
  MODIFY `hazard_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `incident_types`
--
ALTER TABLE `incident_types`
  MODIFY `incident_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `responders`
--
ALTER TABLE `responders`
  MODIFY `responder_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `user_settings`
--
ALTER TABLE `user_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `vehicles`
--
ALTER TABLE `vehicles`
  MODIFY `vehicle_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `device_tokens`
--
ALTER TABLE `device_tokens`
  ADD CONSTRAINT `device_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `emergency_requests`
--
ALTER TABLE `emergency_requests`
  ADD CONSTRAINT `emergency_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `emergency_requests_ibfk_2` FOREIGN KEY (`incident_type_id`) REFERENCES `incident_types` (`incident_type_id`);

--
-- Constraints for table `feedback`
--
ALTER TABLE `feedback`
  ADD CONSTRAINT `feedback_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `hazards`
--
ALTER TABLE `hazards`
  ADD CONSTRAINT `hazards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`barangay_id`);

--
-- Constraints for table `user_settings`
--
ALTER TABLE `user_settings`
  ADD CONSTRAINT `user_settings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `vehicles`
--
ALTER TABLE `vehicles`
  ADD CONSTRAINT `fk_vehicle_responder` FOREIGN KEY (`responder_id`) REFERENCES `responders` (`responder_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
