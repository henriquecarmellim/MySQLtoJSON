const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Caminho do arquivo de configuração
const configFilePath = './dbConfig.json';
const jsonDirectoryPath = './bkp'; // Diretório para os arquivos JSON

// Configuração do readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Função para garantir que o diretório existe
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    fs.mkdirSync(dirname, { recursive: true });
    return true;
}

// Função para obter ou criar configuração do banco de dados
async function getDBConfig() {
    if (fs.existsSync(configFilePath)) {
        const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        console.log(`\n✅ Configuração encontrada! Usando as configurações salvas:`)
        console.log(config);
        return config;
    }

    console.log(`\n⚙️ Vamos configurar o banco de dados. Digite as informações a seguir:`);

    const config = {};
    await new Promise((resolve) => {
        rl.question("🔑 Host (padrão: localhost): ", (host) => {
            config.host = host || 'localhost';
            rl.question("🔑 Usuário (padrão: root): ", (user) => {
                config.user = user || 'root';
                rl.question("🔑 Senha: ", (password) => {
                    config.password = password;
                    rl.question("🔑 Nome do Banco de Dados: ", (database) => {
                        config.database = database;
                        ensureDirectoryExistence(configFilePath); // Garante que o diretório exista
                        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
                        console.log("\n✅ Configuração salva no arquivo 'dbConfig.json'.");
                        resolve();
                    });
                });
            });
        });
    });

    return config;
}

// Função para exportar os dados de uma tabela para JSON
async function exportTableToJSON(config, tableName) {
    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);

        const result = {
            tableName: tableName,
            data: rows
        };

        // Garante que o diretório existe antes de escrever o arquivo JSON
        ensureDirectoryExistence(`${jsonDirectoryPath}/${tableName}.json`);

        fs.writeFileSync(`${jsonDirectoryPath}/${tableName}.json`, JSON.stringify(result, null, 2));
        console.log(`\n✨ Dados exportados para o arquivo **"${tableName}.json"** com sucesso! ✨`);

        await connection.end();
    } catch (error) {
        console.error('\n❌ Erro ao exportar dados:', error.message);
    }
}

// Função para importar os dados de um arquivo JSON para o MySQL
async function importJSONToTable(config, jsonFile, tableName) {
    try {
        const connection = await mysql.createConnection(config);
        const fileContent = fs.readFileSync(jsonFile, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Verifica se os dados do arquivo JSON estão no formato esperado
        if (!jsonData.data || !Array.isArray(jsonData.data) || jsonData.data.length === 0) {
            throw new Error('O arquivo JSON não contém dados válidos.');
        }

        const keys = Object.keys(jsonData.data[0]);
        const placeholders = keys.map(() => '?').join(',');
        const insertQuery = `INSERT INTO \`${tableName}\` (${keys.join(',')}) VALUES (${placeholders})`;

        for (const row of jsonData.data) {
            await connection.execute(insertQuery, Object.values(row));
        }

        console.log(`\n✨ Dados do arquivo **"${jsonFile}"** importados para a tabela **"${tableName}"** com sucesso! ✨`);

        await connection.end();
    } catch (error) {
        console.error('\n❌ Erro ao importar dados:', error.message);
    }
}

// Menu CLI
function showMenu(config) {
    console.clear();
    console.log(`
    ╔════════════════════════════════════════════╗
    ║            📦 MySQL to JSON CLI            ║
    ╠════════════════════════════════════════════╣
    ║   1. 📤 Exportar dados de uma tabela       ║
    ║   2. 📥 Importar dados de um arquivo JSON  ║
    ║   3. ❌ Sair                                ║
    ╚════════════════════════════════════════════╝
    `);

    rl.question("👉 Escolha uma opção: ", async (choice) => {
        switch (choice) {
            case '1':
                rl.question("\n📝 Digite o nome da tabela para exportar: ", async (tableName) => {
                    await exportTableToJSON(config, tableName);
                    pauseMenu(config);
                });
                break;

            case '2':
                rl.question("\n📝 Digite o caminho do arquivo JSON: ", async (jsonFile) => {
                    rl.question("📝 Digite o nome da tabela para importar: ", async (tableName) => {
                        await importJSONToTable(config, jsonFile, tableName);
                        pauseMenu(config);
                    });
                });
                break;

            case '3':
                console.log("\n👋 Obrigado por usar o MySQL to JSON CLI. Até logo!");
                rl.close();
                break;

            default:
                console.log("\n❌ Opção inválida! Tente novamente.");
                pauseMenu(config);
                break;
        }
    });
}

// Função para pausar antes de mostrar o menu novamente
function pauseMenu(config) {
    rl.question("\n🔄 Pressione Enter para voltar ao menu principal...", () => showMenu(config));
}

// Iniciar o programa
(async () => {
    const config = await getDBConfig();
    showMenu(config);
})();
