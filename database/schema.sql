-- ============================================================
-- SUPPORTDESK — Azure SQL Database Schema
-- Exécuter dans l'Éditeur de requête du portail Azure
-- ============================================================

CREATE TABLE Utilisateurs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nom NVARCHAR(100) NOT NULL,
    prenom NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe NVARCHAR(255) NOT NULL,
    telephone NVARCHAR(20),
    departement NVARCHAR(100),
    date_creation DATETIME2 DEFAULT GETDATE(),
    derniere_connexion DATETIME2,
    statut NVARCHAR(20) DEFAULT 'actif'
);

CREATE TABLE Agents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nom NVARCHAR(100) NOT NULL,
    prenom NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe NVARCHAR(255) NOT NULL,
    specialite NVARCHAR(100),
    niveau NVARCHAR(20) DEFAULT 'niveau1',
    tickets_resolus INT DEFAULT 0,
    note_moyenne DECIMAL(3,2) DEFAULT 0,
    disponible BIT DEFAULT 1,
    date_creation DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE Tickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    reference NVARCHAR(20) NOT NULL UNIQUE,
    titre NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    categorie NVARCHAR(50) NOT NULL,
    priorite NVARCHAR(20) DEFAULT 'normal',
    statut NVARCHAR(30) DEFAULT 'ouvert',
    utilisateur_id INT NOT NULL FOREIGN KEY REFERENCES Utilisateurs(id),
    agent_id INT FOREIGN KEY REFERENCES Agents(id),
    date_creation DATETIME2 DEFAULT GETDATE(),
    date_mise_a_jour DATETIME2 DEFAULT GETDATE(),
    date_resolution DATETIME2,
    sla_echeance DATETIME2,
    satisfaction INT,
    tags NVARCHAR(500),
    piece_jointe_url NVARCHAR(500)
);

CREATE TABLE HistoriqueTickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL FOREIGN KEY REFERENCES Tickets(id),
    auteur_id INT,
    auteur_type NVARCHAR(20),
    action NVARCHAR(50) NOT NULL,
    ancien_statut NVARCHAR(30),
    nouveau_statut NVARCHAR(30),
    commentaire NVARCHAR(MAX),
    date_action DATETIME2 DEFAULT GETDATE(),
    interne BIT DEFAULT 0
);

CREATE TABLE Commentaires (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL FOREIGN KEY REFERENCES Tickets(id),
    auteur_id INT NOT NULL,
    auteur_type NVARCHAR(20),
    contenu NVARCHAR(MAX) NOT NULL,
    date_creation DATETIME2 DEFAULT GETDATE(),
    interne BIT DEFAULT 0
);

CREATE TABLE Notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    destinataire_id INT NOT NULL,
    destinataire_type NVARCHAR(20),
    ticket_id INT FOREIGN KEY REFERENCES Tickets(id),
    type NVARCHAR(50),
    message NVARCHAR(500),
    lue BIT DEFAULT 0,
    date_creation DATETIME2 DEFAULT GETDATE()
);

-- Index pour optimisation
CREATE INDEX IX_Tickets_User ON Tickets(utilisateur_id);
CREATE INDEX IX_Tickets_Agent ON Tickets(agent_id);
CREATE INDEX IX_Tickets_Statut ON Tickets(statut);
CREATE INDEX IX_Tickets_Priorite ON Tickets(priorite);
CREATE INDEX IX_Commentaires_Ticket ON Commentaires(ticket_id);
CREATE INDEX IX_Historique_Ticket ON HistoriqueTickets(ticket_id);

-- Données de démonstration
INSERT INTO Agents (nom, prenom, email, mot_de_passe, specialite, niveau) VALUES
('Martin', 'Sophie', 'sophie.martin@support.com', '$2b$10$rOv/8AJBLmMqT4gZ8QvTHuYJLkP7fXN1sM3nK6eW9dI2cU5jBvzOy', 'Infrastructure Réseau', 'senior'),
('Dubois', 'Pierre', 'pierre.dubois@support.com', '$2b$10$rOv/8AJBLmMqT4gZ8QvTHuYJLkP7fXN1sM3nK6eW9dI2cU5jBvzOy', 'Logiciels & Applications', 'niveau2'),
('Bernard', 'Marie', 'marie.bernard@support.com', '$2b$10$rOv/8AJBLmMqT4gZ8QvTHuYJLkP7fXN1sM3nK6eW9dI2cU5jBvzOy', 'Matériel & Hardware', 'niveau1');

GO

-- Procédure pour générer les références
CREATE OR ALTER PROCEDURE GenerateTicketReference
    @reference NVARCHAR(20) OUTPUT
AS
BEGIN
    DECLARE @year CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4))
    DECLARE @count INT
    SELECT @count = COUNT(*) + 1 FROM Tickets WHERE YEAR(date_creation) = YEAR(GETDATE())
    SET @reference = 'TKT-' + @year + '-' + RIGHT('0000' + CAST(@count AS NVARCHAR(4)), 4)
END;