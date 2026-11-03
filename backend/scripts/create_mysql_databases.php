<?php

$host = '127.0.0.1';
$port = 3306;
$username = 'root';
$password = '';

$pdo = new PDO("mysql:host={$host};port={$port}", $username, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

$pdo->exec('CREATE DATABASE IF NOT EXISTS flujocaja_tema_peru CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('CREATE DATABASE IF NOT EXISTS flujocaja_tema_peru_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

echo "Bases de datos listas.\n";
