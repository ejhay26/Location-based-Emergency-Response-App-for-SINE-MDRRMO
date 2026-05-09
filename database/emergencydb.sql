-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 08, 2026 at 05:53 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

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

-- --------------------------------------------------------

--
-- Table structure for table `emergency_requests`
--

CREATE TABLE `emergency_requests` 
  `request_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `incident_type_id` int(11) DEFAULT NULL,
  `image_proof` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `request_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
 ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `emergency_requests`
--

INSERT INTO `emergency_requests` (`request_id`, `user_id`, `incident_type_id`, `image_proof`, `latitude`, `longitude`, `status`, `request_time`, `created_at`, `updated_at`, `deleted_at`) VALUES
(3, 1, 3, NULL, 15.30542100, 120.91368200, 'Cancelled', '2026-05-08 02:46:44', '2026-05-08 02:46:44', '2026-05-08 07:18:13', NULL);

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
(4, 'Crime');

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
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `first_name`, `last_name`, `username`, `phone`, `birthdate`, `profile_picture`, `email`, `password`, `role`, `account_status`, `barangay_id`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Emmanuel John', 'Perez', 'user1', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'ejperez623@gmail.com', '$2y$12$MNajtoT1vSxVNOw6I2pt.e7ipmAOb4Cy3HOAPsyxLwg/IZoxd/Eni', 'citizen', 'active', 9, '2026-05-07 05:45:17', '2026-05-07 17:33:12', NULL),
(3, 'Emmanuel', 'Perezzz', 'user2', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'ejperez634@gmail.com', '$2y$12$rEM8co2YcwxaGgxRDZkzzu372zNnL1J8UzVfXdykwnGXuFB0SkoRe', 'citizen', 'active', 1, '2026-05-07 05:45:17', '2026-05-07 17:33:20', NULL),
(4, 'admin_user', 'Admin', 'admin', 'N/A', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'admin_user@sine.gov.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', 1, '2026-05-07 05:45:17', '2026-05-07 17:31:52', NULL),
(8, 'Dispatcher 1', '1', 'dispatcher1', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'dis@mail.com', '$2y$12$7O1Kw6owYNV9D5wcfJxs5./mGMgpzOYv06Ipi1D4XoxsoiHNwuZ8O', 'dispatcher', 'active', 3, '2026-05-07 16:23:26', '2026-05-08 08:52:34', NULL),
(9, 'dispatcher', '2', 'dispatcher2', '09123456789', NULL, 'https://ionicframework.com/docs/img/demos/avatar.svg', 'dis2@mail.com', '$2y$12$WuAbG0j2AFQjlMC/RttG4OF5qv2k372lv6qeIOfjJue5FnBJ8Eml.', 'dispatcher', 'active', 4, '2026-05-08 09:28:54', '2026-05-08 09:28:54', NULL);

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
  ADD KEY `incident_type_id` (`incident_type_id`),

--
-- Indexes for table `incident_types`
--
ALTER TABLE `incident_types`
  ADD PRIMARY KEY (`incident_type_id`);

--
-- Indexes for table `responders`
--
ALTER TABLE `responders`
  ADD PRIMARY KEY (`responder_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `barangay_id` (`barangay_id`);

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
-- AUTO_INCREMENT for table `dispatch`
--
ALTER TABLE `dispatch`
  MODIFY `dispatch_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `emergency_requests`
--
ALTER TABLE `emergency_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `incident_types`
--
ALTER TABLE `incident_types`
  MODIFY `incident_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `responders`
--
ALTER TABLE `responders`
  MODIFY `responder_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `vehicles`
--
ALTER TABLE `vehicles`
  MODIFY `vehicle_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `emergency_requests`
--
ALTER TABLE `emergency_requests`
  ADD CONSTRAINT `emergency_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `emergency_requests_ibfk_2` FOREIGN KEY (`incident_type_id`) REFERENCES `incident_types` (`incident_type_id`),

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`barangay_id`);

--
-- Constraints for table `vehicles`
--
ALTER TABLE `vehicles`
  ADD CONSTRAINT `fk_vehicle_responder` FOREIGN KEY (`responder_id`) REFERENCES `responders` (`responder_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
