-- Migration pour ajouter les champs de liaison aux ressources (VM, LXC, Docker)
ALTER TABLE apps ADD COLUMN resource_type TEXT NULL; -- 'vm' | 'lxc' | 'docker'
ALTER TABLE apps ADD COLUMN resource_id TEXT NULL;    -- ID de la ressource (vmid pour VM/LXC, container id pour Docker)
ALTER TABLE apps ADD COLUMN resource_node TEXT NULL;  -- Nom du nœud Proxmox (pour VM/LXC uniquement)

