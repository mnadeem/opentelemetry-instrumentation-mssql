import * as childProcess from 'child_process';

export function start(db: 'redis' | 'mysql' | 'postgres' | 'mssql') {
    let dockerRunCmd;
    switch (db) {
        case 'redis':
            dockerRunCmd = `docker run -d -p 63790:6379 --name ot${db} ${db}:alpine`;
            break;

        case 'mysql':
            dockerRunCmd = `docker run --rm -d -p 33306:3306 --name ot${db} -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=test_db -e MYSQL_USER=otel -e MYSQL_PASSWORD=secret  circleci/${db}:5.7`;
            break;

        case 'postgres':
            dockerRunCmd = `docker run -d -p 54320:5432 --name ot${db} ${db}:alpine`;
            break;
        
        case 'mssql':
            dockerRunCmd = `docker run -d -p 1433:1433 --name ot${db} -e ACCEPT_EULA=Y -e SA_PASSWORD=P@ssw0rd mcr.microsoft.com/mssql/server`;
            break;
    }

    const tasks = [run(dockerRunCmd)];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (task && task.code !== 0) {
            console.error('Failed to start container!');
            console.error(task.output);
            return false;
        }
    }
    return true;
}

export function cleanUp(db: 'redis' | 'mysql' | 'postgres' | 'mssql') {
    run(`docker stop ot${db}`);
    run(`docker rm ot${db}`);
}

function run(cmd: string) {
    try {
        const proc = childProcess.spawnSync(cmd, {
            shell: true,
        });
        return {
            code: proc.status,
            output: proc.output
                .map(v => String.fromCharCode.apply(null, v as any))
                .join(''),
        };
    } catch (e) {
        console.log(e);
        return;
    }
}
