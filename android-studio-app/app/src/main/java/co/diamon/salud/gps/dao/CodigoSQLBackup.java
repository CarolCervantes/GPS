package co.diamon.salud.gps.dao;

public class CodigoSQLBackup {

    public static String sqlBackup = "CREATE TABLE IF NOT EXISTS [RegistrosClinicos] (\n" +
            " [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL ,\n" +
            " [paciente] VARCHAR NOT NULL DEFAULT 'Damian Diaz Balseiro' ,\n" +
            " [glucosa] VARCHAR NOT NULL ,\n" +
            " [presion] VARCHAR NOT NULL ,\n" +
            " [medicamento] VARCHAR ,\n" +
            " [ubicacion] VARCHAR DEFAULT 'Chapacua (10.39991, -75.47886)'\n" +
            ");\n" +
            "INSERT OR IGNORE INTO [RegistrosClinicos] ([id], [paciente], [glucosa], [presion], [medicamento], [ubicacion]) VALUES " +
            "(1, 'Damian Diaz Balseiro', '114 mg/dL (Ayunas)', '126/78 mmHg', '8AM: Pantoprazol, Metformina, Firialta, Nifedipina', 'Casa Chapacua (10.39991, -75.47886)');\n" +
            "INSERT OR IGNORE INTO [RegistrosClinicos] ([id], [paciente], [glucosa], [presion], [medicamento], [ubicacion]) VALUES " +
            "(2, 'Damian Diaz Balseiro', '142 mg/dL (2h Post)', '130/80 mmHg', '2PM: Valsartan | 8PM: Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino | 9PM: Insulina 24 UI', 'Barrio Chapacua, Cartagena');";
}
