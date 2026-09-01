-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: db_sacou
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alternativa`
--

DROP TABLE IF EXISTS `alternativa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alternativa` (
  `ID_ALTERNATIVA` int NOT NULL AUTO_INCREMENT,
  `ID_PERGUNTA` int NOT NULL,
  `TEXTO` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `EH_CORRETA` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID_ALTERNATIVA`),
  KEY `ID_PERGUNTA` (`ID_PERGUNTA`),
  CONSTRAINT `alternativa_ibfk_1` FOREIGN KEY (`ID_PERGUNTA`) REFERENCES `pergunta` (`ID_PERGUNTA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `aluno`
--

DROP TABLE IF EXISTS `aluno`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `aluno` (
  `ID_USUARIO` int NOT NULL,
  `ID_TURMA` int NOT NULL,
  `NICKNAME` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `XP_TOTAL` int DEFAULT '0',
  `MOEDAS_TOTAL` int DEFAULT '0',
  `NIVEL_ATUAL` int DEFAULT '1',
  `DATA_EXCLUSAO` datetime DEFAULT NULL,
  PRIMARY KEY (`ID_USUARIO`),
  KEY `ID_TURMA` (`ID_TURMA`),
  CONSTRAINT `aluno_ibfk_1` FOREIGN KEY (`ID_USUARIO`) REFERENCES `usuario` (`ID_USUARIO`) ON DELETE CASCADE,
  CONSTRAINT `aluno_ibfk_2` FOREIGN KEY (`ID_TURMA`) REFERENCES `turma` (`ID_TURMA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `coordenador`
--

DROP TABLE IF EXISTS `coordenador`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coordenador` (
  `ID_USUARIO` int NOT NULL,
  `ID_ESCOLA` int NOT NULL,
  PRIMARY KEY (`ID_USUARIO`),
  KEY `ID_ESCOLA` (`ID_ESCOLA`),
  CONSTRAINT `coordenador_ibfk_1` FOREIGN KEY (`ID_USUARIO`) REFERENCES `usuario` (`ID_USUARIO`) ON DELETE CASCADE,
  CONSTRAINT `coordenador_ibfk_2` FOREIGN KEY (`ID_ESCOLA`) REFERENCES `escola` (`ID_ESCOLA`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `escola`
--

DROP TABLE IF EXISTS `escola`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `escola` (
  `ID_ESCOLA` int NOT NULL AUTO_INCREMENT,
  `CNPJ` varchar(18) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `NOME_INSTITUICAO` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ID_CRIADOR_ADMIN` int DEFAULT NULL,
  `STATUS_ATIVO` tinyint(1) DEFAULT '1',
  `DATA_EXCLUSAO` datetime DEFAULT NULL,
  PRIMARY KEY (`ID_ESCOLA`),
  UNIQUE KEY `CNPJ` (`CNPJ`),
  KEY `ID_CRIADOR_ADMIN` (`ID_CRIADOR_ADMIN`),
  CONSTRAINT `escola_ibfk_1` FOREIGN KEY (`ID_CRIADOR_ADMIN`) REFERENCES `usuario` (`ID_USUARIO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventario`
--

DROP TABLE IF EXISTS `inventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventario` (
  `ID_INVENTARIO` int NOT NULL AUTO_INCREMENT,
  `ID_ALUNO` int NOT NULL,
  `ID_ITEM` int NOT NULL,
  `ESTA_EQUIPADO` tinyint(1) DEFAULT '0' COMMENT '1 = Equipado, 0 = Guardado',
  PRIMARY KEY (`ID_INVENTARIO`),
  KEY `ID_ALUNO` (`ID_ALUNO`),
  KEY `ID_ITEM` (`ID_ITEM`),
  CONSTRAINT `inventario_ibfk_1` FOREIGN KEY (`ID_ALUNO`) REFERENCES `aluno` (`ID_USUARIO`),
  CONSTRAINT `inventario_ibfk_2` FOREIGN KEY (`ID_ITEM`) REFERENCES `item_loja` (`ID_ITEM`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_loja`
--

DROP TABLE IF EXISTS `item_loja`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_loja` (
  `ID_ITEM` int NOT NULL AUTO_INCREMENT,
  `NOME_ITEM` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PRECO_SAC_MOEDAS` int NOT NULL,
  `CATEGORIA` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ACESSO, STATUS, ELITE, COROA',
  `REQUISITO_TRILHA` int DEFAULT NULL COMMENT 'ID da trilha mínima para desbloquear',
  `URL_IMAGEM` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL PNG Transparente (Ex: Cloudinary)',
  `POSICAO_Z` int NOT NULL DEFAULT '3',
  PRIMARY KEY (`ID_ITEM`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `licao`
--

DROP TABLE IF EXISTS `licao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `licao` (
  `ID_LICAO` int NOT NULL AUTO_INCREMENT,
  `ID_TRILHA` int NOT NULL,
  `TITULO` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `CONTEUDO_VIDEO` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `CONTEUDO_AUDIO` text COLLATE utf8mb4_unicode_ci,
  `RECOMPENSA_XP_MAX` int NOT NULL,
  `RECOMPENSA_MOEDAS_MAX` int NOT NULL,
  `ORDEM` int NOT NULL,
  PRIMARY KEY (`ID_LICAO`),
  KEY `ID_TRILHA` (`ID_TRILHA`),
  CONSTRAINT `licao_ibfk_1` FOREIGN KEY (`ID_TRILHA`) REFERENCES `trilha` (`ID_TRILHA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pergunta`
--

DROP TABLE IF EXISTS `pergunta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pergunta` (
  `ID_PERGUNTA` int NOT NULL AUTO_INCREMENT,
  `ID_LICAO` int NOT NULL,
  `ENUNCIADO` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `EXPLICACAO_FEEDBACK` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`ID_PERGUNTA`),
  KEY `ID_LICAO` (`ID_LICAO`),
  CONSTRAINT `pergunta_ibfk_1` FOREIGN KEY (`ID_LICAO`) REFERENCES `licao` (`ID_LICAO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `professor`
--

DROP TABLE IF EXISTS `professor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `professor` (
  `ID_USUARIO` int NOT NULL,
  `ID_ESCOLA` int NOT NULL,
  PRIMARY KEY (`ID_USUARIO`),
  KEY `ID_ESCOLA` (`ID_ESCOLA`),
  CONSTRAINT `professor_ibfk_1` FOREIGN KEY (`ID_USUARIO`) REFERENCES `usuario` (`ID_USUARIO`) ON DELETE CASCADE,
  CONSTRAINT `professor_ibfk_2` FOREIGN KEY (`ID_ESCOLA`) REFERENCES `escola` (`ID_ESCOLA`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `progresso_licao`
--

DROP TABLE IF EXISTS `progresso_licao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `progresso_licao` (
  `ID_PROGRESSO` int NOT NULL AUTO_INCREMENT,
  `ID_ALUNO` int NOT NULL,
  `ID_LICAO` int NOT NULL,
  `QTD_ACERTOS` int DEFAULT '0',
  `STATUS_APROVACAO` tinyint(1) DEFAULT '0' COMMENT '1=Aprovado, 0=Reprovado',
  `DATA_CONCLUSAO` datetime DEFAULT NULL,
  PRIMARY KEY (`ID_PROGRESSO`),
  UNIQUE KEY `UNQ_ALUNO_LICAO` (`ID_ALUNO`,`ID_LICAO`),
  KEY `ID_LICAO` (`ID_LICAO`),
  CONSTRAINT `progresso_licao_ibfk_1` FOREIGN KEY (`ID_ALUNO`) REFERENCES `aluno` (`ID_USUARIO`),
  CONSTRAINT `progresso_licao_ibfk_2` FOREIGN KEY (`ID_LICAO`) REFERENCES `licao` (`ID_LICAO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `token_recuperacao`
--

DROP TABLE IF EXISTS `token_recuperacao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_recuperacao` (
  `ID_TOKEN` int NOT NULL AUTO_INCREMENT,
  `ID_USUARIO` int NOT NULL,
  `TOKEN_HASH` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `DATA_CRIACAO` datetime DEFAULT CURRENT_TIMESTAMP,
  `DATA_EXPIRACAO` datetime NOT NULL,
  `UTILIZADO` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`ID_TOKEN`),
  KEY `ID_USUARIO` (`ID_USUARIO`),
  CONSTRAINT `token_recuperacao_ibfk_1` FOREIGN KEY (`ID_USUARIO`) REFERENCES `usuario` (`ID_USUARIO`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trilha`
--

DROP TABLE IF EXISTS `trilha`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trilha` (
  `ID_TRILHA` int NOT NULL AUTO_INCREMENT,
  `NOME_TRILHA` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PONTUACAO_MIN` int NOT NULL,
  `PONTUACAO_MAX` int NOT NULL,
  PRIMARY KEY (`ID_TRILHA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `turma`
--

DROP TABLE IF EXISTS `turma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `turma` (
  `ID_TURMA` int NOT NULL AUTO_INCREMENT,
  `ID_ESCOLA` int NOT NULL,
  `NOME_SERIE` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '1º Ano EM, 2º Ano EM, 3º Ano EM',
  `ANO_LETIVO` int NOT NULL,
  `NOME_TURMA` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ex: Turma A, Vespertino',
  `DATA_EXCLUSAO` datetime DEFAULT NULL,
  PRIMARY KEY (`ID_TURMA`),
  KEY `ID_ESCOLA` (`ID_ESCOLA`),
  CONSTRAINT `turma_ibfk_1` FOREIGN KEY (`ID_ESCOLA`) REFERENCES `escola` (`ID_ESCOLA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `ID_USUARIO` int NOT NULL AUTO_INCREMENT,
  `NOME_COMPLETO` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `EMAIL` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `SENHA` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `TIPO_PERFIL` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ADMIN, COORDENADOR, PROFESSOR, ALUNO',
  `DATA_CRIACAO` datetime DEFAULT CURRENT_TIMESTAMP,
  `DATA_EXCLUSAO` datetime DEFAULT NULL,
  `STATUS_ATIVO` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ID_USUARIO`),
  UNIQUE KEY `EMAIL` (`EMAIL`),
  KEY `idx_email` (`EMAIL`),
  KEY `idx_status` (`STATUS_ATIVO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11 20:55:03
